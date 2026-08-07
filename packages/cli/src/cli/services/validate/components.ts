import {validateComponentCodeBlock} from './engine/components/validate-component-code-block.js'
import {loadTypeScript} from './engine/components/typescript-loader.js'
import {resolveValidateDataDir, readVersionCatalog} from './engine/data-loader.js'
import type {ValidationLanguage} from './engine/components/extract-component-validations.js'
import {getSupportedVersions, resolveVersion, type VersionSource} from './engine/version-resolution.js'
import {recordValidateMetadata} from './engine/telemetry.js'
import {ValidationResult, type ValidationResponse} from './engine/contract.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

export type {ValidationLanguage}

// The `dataSubdir` and marker used to locate the bundled components reference
// data (`assets/validate/components/types/index.json` in dev, or the mirrored
// path under `dist/` when bundled).
const COMPONENTS_DATA_SUBDIR = 'components'
const COMPONENTS_DATA_MARKER = ['types', 'index.json'] as const

/**
 * Inputs to the pure {@link validateComponents} core. `code` and `file` are the
 * raw flag values; the core reads `file` itself (inside its own error handling)
 * so a bad path becomes a structured FAILED response rather than a thrown error.
 */
export interface ValidateComponentsOptions {
  /** The Shopify API to validate against (e.g. `polaris-app-home`). */
  api: string
  /** Component code passed inline via `--code`. */
  code?: string
  /** Path to a file whose contents to validate, passed via `--file`. */
  file?: string
  /** Extension target (required for extension-surface APIs). */
  target?: string
  /** Requested API version; omitted means "latest" for versioned APIs. */
  version?: string
  /** Code-fence language; defaults to TSX in the engine. */
  language?: ValidationLanguage
  /**
   * Test seam: the resolved reference-data directory. Production omits this and
   * lets the core locate the bundled data via {@link resolveValidateDataDir}.
   */
  dataDir?: string
}

/** The structured outcome of a components validation run. */
export interface ValidateComponentsResult {
  /** True when the single validated code block passed (SUCCESS). */
  success: boolean
  /** The validation responses, byte-for-byte compatible with the source tool. */
  responses: ValidationResponse[]
  /** The version actually validated against (undefined for unversioned APIs). */
  resolvedVersion?: string
  /** Whether `resolvedVersion` was explicitly requested or defaulted to latest. */
  versionSource?: VersionSource
}

function failedResult(detail: string): ValidateComponentsResult {
  return {
    success: false,
    responses: [
      {
        result: ValidationResult.FAILED,
        resultDetail: detail,
        componentValidationErrors: [],
        genericErrors: [],
      },
    ],
  }
}

/**
 * Pure core: validates a single component code block for a Shopify API and
 * returns a structured result. Never renders, exits, or records telemetry — the
 * orchestrator does that. Reads the `--file` contents itself so a missing/
 * unreadable path yields a structured FAILED response (mirroring the source
 * tool's `main().catch`), not an oclif crash.
 *
 * Deterministic: the source tool's random-UUID artifact-id/revision lineage is
 * intentionally dropped, so identical inputs always produce identical output.
 */
export async function validateComponents(options: ValidateComponentsOptions): Promise<ValidateComponentsResult> {
  const dataDir = options.dataDir ?? resolveValidateDataDir(COMPONENTS_DATA_SUBDIR, COMPONENTS_DATA_MARKER)
  const catalog = readVersionCatalog(dataDir)

  // Resolve the code. Read `--file` here (not in the command) so a bad path is a
  // structured FAILED rather than a thrown error.
  let code = options.code
  if (options.file !== undefined) {
    try {
      code = await readFile(options.file)
    } catch {
      return failedResult(`Failed to read file: ${options.file}`)
    }
  }

  // Resolve the version for versioned APIs. Unversioned APIs (polaris-app-home)
  // have no catalog entry and reject an explicit `--version`.
  let resolvedVersion: string | undefined
  let versionSource: VersionSource | undefined
  const supportedVersions = getSupportedVersions(catalog, options.api)
  if (supportedVersions.length > 0) {
    const resolution = resolveVersion(catalog, options.api, options.version)
    if (!resolution.ok) {
      return failedResult(
        options.version
          ? `Version '${options.version}' is not available for API '${options.api}'. Available versions for '${options.api}': ${resolution.supportedVersions.join(', ')}.`
          : `No supported versions available for API '${options.api}'.`,
      )
    }
    resolvedVersion = resolution.version
    versionSource = resolution.source
  } else if (options.version) {
    return failedResult(`API '${options.api}' does not support version selection; remove --version.`)
  }

  const typescript = await loadTypeScript()
  const response = validateComponentCodeBlock({
    typescript,
    code: code ?? '',
    apiName: options.api,
    version: resolvedVersion,
    extensionTarget: options.target,
    language: options.language,
    dataDir,
    catalog,
  })

  // Normalize the optional component-only fields so the JSON payload is stable
  // regardless of which branch the engine took.
  const responses: ValidationResponse[] = [
    {
      result: response.result,
      resultDetail: response.resultDetail,
      componentValidationErrors: response.componentValidationErrors ?? [],
      genericErrors: response.genericErrors ?? [],
      unvalidatedComponents: response.unvalidatedComponents ?? [],
      validatedComponents: response.validatedComponents ?? [],
    },
  ]

  return {
    success: response.result === ValidationResult.SUCCESS,
    responses,
    resolvedVersion,
    versionSource,
  }
}

/** Inputs to the {@link runComponentsValidateCommand} orchestrator. */
export interface RunComponentsValidateCommandOptions extends Omit<ValidateComponentsOptions, 'dataDir'> {
  /** Whether to emit machine-readable JSON instead of rendered output. */
  json: boolean
}

/**
 * Orchestrates a components validation run for the CLI command: invokes the pure
 * core, records telemetry, renders human output (or emits JSON), and throws
 * {@link AbortSilentError} on failure so the process exits non-zero without a
 * duplicate error render.
 */
export async function runComponentsValidateCommand(options: RunComponentsValidateCommandOptions): Promise<void> {
  let result: ValidateComponentsResult
  try {
    result = await validateComponents(options)
  } catch (error) {
    // Mirror the source `main().catch`: any unexpected error (e.g. missing
    // bundled data, TypeScript failing to load) becomes a structured FAILED
    // response so `--json` consumers get `{success, responses}` and not a crash.
    result = failedResult(error instanceof Error ? error.message : String(error))
  }

  await recordValidateMetadata({
    subcommand: 'components',
    result: result.success ? ValidationResult.SUCCESS : ValidationResult.FAILED,
    api: options.api,
    apiVersion: result.resolvedVersion,
    json: options.json,
  })

  if (options.json) {
    outputResult(
      JSON.stringify(
        {success: result.success, responses: result.responses, resolvedVersion: result.resolvedVersion},
        null,
        2,
      ),
    )
    if (!result.success) {
      throw new AbortSilentError()
    }
    return
  }

  // Human output. The components validator returns exactly one response and
  // never emits INFORM, so it is SUCCESS -> renderSuccess or FAILED -> renderError.
  const [response] = result.responses
  const detail = response?.resultDetail ?? ''

  if (result.versionSource === 'default' && result.resolvedVersion) {
    renderWarning({
      headline: 'Using the default API version.',
      body: `Validated against ${result.resolvedVersion}, the latest version for '${options.api}'. Pass --version to pin a specific version.`,
    })
  }

  if (result.success) {
    renderSuccess({headline: 'Components are valid.', body: detail})
    return
  }

  renderError({headline: 'Components validation failed.', body: detail})
  throw new AbortSilentError()
}

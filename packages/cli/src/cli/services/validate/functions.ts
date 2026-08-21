/**
 * Service for `shopify validate functions`.
 *
 * Validates a GraphQL input-query operation for a Shopify Functions API against
 * a schema bundled offline with the CLI. No network, no login, deterministic.
 *
 * Split in two, per the shared foundation's convention:
 *   - `validateFunctions` — the pure core. Given the already-read operation
 *     string, the api, and an optional requested version, it resolves the
 *     version, validates the input query against the bundled schema, and returns
 *     a structured result. It never reads stdin, never renders, and never exits
 *     the process — so it is trivially unit-testable against the real bundled
 *     data.
 *   - `runFunctionsValidateCommand` — the thin orchestrator the oclif command
 *     calls. It reads the operation (from --code / --file / stdin), records
 *     telemetry, renders human or JSON output, and signals a non-zero exit via
 *     `AbortSilentError` on failure — matching the `app config validate` idiom.
 *
 * I/O contract:
 *   - `--json` shape: `{success, responses, resolvedVersion?}` (pretty-printed).
 *   - Exit 0 on SUCCESS or INFORM, 1 on FAILED or error.
 *   - Deprecations downgrade to INFORM (validateGraphQLOperation is called with
 *     `failOnDeprecated: false`).
 */

import {FUNCTIONS_API_IDS, isFunctionsApi} from './engine/apis.js'
import {ValidationResult, ValidationToolResult} from './engine/contract.js'
import {resolveVersion} from './engine/version-resolution.js'
import {createDiskSchemaSource, resolveValidateDataDir, schemaPathFor} from './engine/data-loader.js'
import {validateGraphQLOperation} from './engine/graphql-validation.js'
import {recordValidateMetadata} from './engine/telemetry.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {isStdinPiped, readStdinString} from '@shopify/cli-kit/node/system'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import type {ResolvedApiSchema, SchemaSource} from './engine/schema-source.js'

// The subdirectory of `assets/validate` that holds the Functions schemas, and
// the catalog file that marks it (used by the data loader to locate the dir).
const FUNCTIONS_DATA_SUBDIR = 'functions'
const VERSION_CATALOG_MARKER = ['supported-versions-schema.json']

/** Inputs the pure validation core operates on. */
export interface ValidateFunctionsOptions {
  /** The GraphQL input-query operation to validate. */
  code: string
  /** The Functions API to validate against (e.g. functions_discount). */
  api: string
  /** Optional requested API version; defaults to the API's latest stable. */
  requestedVersion?: string
  /**
   * Test seams. `dataDir` points the loader at a fixture directory; `schemaSource`
   * swaps the whole catalog/byte source. Production callers pass neither.
   */
  dataDir?: string
  schemaSource?: SchemaSource
}

/** The pure result of validating one operation, before rendering. */
export interface ValidateFunctionsResult {
  /** True when validation passed (SUCCESS or INFORM); false on FAILED/error. */
  success: boolean
  /** Structured responses — the machine-readable `--json` payload body. */
  responses: ValidationToolResult
  /** The version validated against, when one was resolved. */
  resolvedVersion?: string
  /** "Version validated against is X." when the version was defaulted; empty otherwise. */
  versionNote: string
}

/** Builds a single-FAILED result for an error path. */
function failure(message: string): ValidateFunctionsResult {
  return {
    success: false,
    responses: [{result: ValidationResult.FAILED, resultDetail: message}],
    versionNote: '',
  }
}

/**
 * Core validation. Never throws for expected failures (unknown API, unsupported
 * version, invalid operation) — those become a FAILED response so every caller
 * renders them identically. Unexpected errors are also captured as FAILED.
 */
export async function validateFunctions(options: ValidateFunctionsOptions): Promise<ValidateFunctionsResult> {
  const {code, api, requestedVersion} = options

  if (!isFunctionsApi(api)) {
    return failure(`Unknown Functions API '${api}'. Available APIs: ${FUNCTIONS_API_IDS.join(', ')}.`)
  }

  try {
    const dataDir = options.dataDir ?? resolveValidateDataDir(FUNCTIONS_DATA_SUBDIR, VERSION_CATALOG_MARKER)
    const schemaSource = options.schemaSource ?? createDiskSchemaSource(dataDir)
    const catalog = schemaSource.readVersionCatalog()
    const resolution = resolveVersion(catalog, api, requestedVersion)

    if (!resolution.ok) {
      const message = requestedVersion
        ? `Version '${requestedVersion}' is not available for API '${api}'. Available versions for '${api}': ${resolution.supportedVersions.join(
            ', ',
          )}.`
        : `No supported versions available for API '${api}'.`
      return failure(message)
    }

    const apiVersion: ResolvedApiSchema = {
      api,
      name: resolution.version,
      schemaPath: schemaPathFor(dataDir, api, resolution.version),
      latestVersion: resolution.source === 'default',
    }

    const {validation} = await validateGraphQLOperation(code, api, {
      apiVersion,
      failOnDeprecated: false,
      schemaSource,
    })

    return {
      success: validation.result !== ValidationResult.FAILED,
      responses: [{result: validation.result, resultDetail: validation.resultDetail}],
      resolvedVersion: resolution.version,
      versionNote: resolution.source === 'default' ? `Version validated against is ${resolution.version}.` : '',
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

/** Options the command forwards to the orchestrator. */
export interface RunFunctionsValidateOptions {
  /** Operation passed via --code. */
  code?: string
  /** Path to a file containing the operation, passed via --file. */
  file?: string
  /** The Functions API to validate against (required). */
  api: string
  /** Optional requested API version; defaults to the API's latest stable. */
  requestedVersion?: string
  /** Emit the machine-readable JSON payload instead of rendered output. */
  json: boolean
  /** Test seams, forwarded to the pure core. */
  dataDir?: string
  schemaSource?: SchemaSource
}

/**
 * Resolves the operation from --code, --file, or stdin (in that precedence).
 * Throws an {@link AbortError} when no operation can be obtained; the caller
 * turns that into a structured FAILED result so bad input never crashes oclif.
 */
async function resolveOperation(options: {code?: string; file?: string}): Promise<string> {
  if (options.code !== undefined) return options.code
  if (options.file !== undefined) return readFile(options.file)

  const noInputHint = 'Pass the operation with --code, read it from a file with --file, or pipe it via stdin.'
  if (!isStdinPiped()) {
    throw new AbortError('No GraphQL operation provided.', noInputHint)
  }

  const stdin = await readStdinString()
  if (stdin === undefined || stdin.trim() === '') {
    throw new AbortError('No GraphQL operation provided.', noInputHint)
  }
  return stdin
}

/**
 * Orchestration entry point the command calls. Reads the operation, validates
 * it, records telemetry, and renders human or JSON output — throwing
 * `AbortSilentError` to signal a non-zero exit on failure. All input reading
 * happens inside the try/catch so a missing --file or empty stdin becomes a
 * structured FAILED result rather than an unhandled crash.
 */
export async function runFunctionsValidateCommand(options: RunFunctionsValidateOptions): Promise<void> {
  const {json, code, file, api, requestedVersion, dataDir, schemaSource} = options

  let result: ValidateFunctionsResult
  try {
    const operation = await resolveOperation({code, file})
    result = await validateFunctions({code: operation, api, requestedVersion, dataDir, schemaSource})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    result = failure(error instanceof Error ? error.message : String(error))
  }

  await recordValidateMetadata({
    subcommand: 'functions',
    result: result.responses[0]?.result ?? ValidationResult.FAILED,
    api,
    apiVersion: result.resolvedVersion,
    json,
  })

  if (json) {
    outputResult(
      JSON.stringify(
        {
          success: result.success,
          responses: result.responses,
          ...(result.resolvedVersion ? {resolvedVersion: result.resolvedVersion} : {}),
        },
        null,
        2,
      ),
    )
    if (!result.success) throw new AbortSilentError()
    return
  }

  renderOutcome(result)
}

/**
 * Renders the outcome as a tokenized body (the result detail plus any
 * defaulted-version note) via the cli-kit UI, choosing the box by status. The
 * raw markdown summary is intentionally not dumped into the box; the primary
 * human surface is this tokenized body. Throws on failure to force exit 1.
 */
function renderOutcome(result: ValidateFunctionsResult): void {
  const detail = result.responses.map((response) => response.resultDetail).join('\n\n')
  const body = result.versionNote ? `${detail}\n\n${result.versionNote}` : detail
  const [response] = result.responses

  if (response?.result === ValidationResult.SUCCESS) {
    renderSuccess({headline: 'Functions input query is valid.', body})
  } else if (response?.result === ValidationResult.INFORM) {
    renderWarning({headline: 'Functions input query is valid, with warnings.', body})
  } else {
    renderError({headline: 'Functions input query validation failed.', body})
    throw new AbortSilentError()
  }
}

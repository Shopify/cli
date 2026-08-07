import {ValidationResult, ValidationToolResult} from './engine/contract.js'
import {validateGraphQLOperation} from './engine/graphql-validation.js'
import {formatScopes} from './engine/offline-scopes.js'
import {resolveVersion} from './engine/version-resolution.js'
import {createDiskSchemaSource, resolveValidateDataDir, schemaPathFor} from './engine/data-loader.js'
import {GRAPHQL_APIS, isGraphqlApi} from './engine/apis.js'
import {recordValidateMetadata} from './engine/telemetry.js'
import {readFile} from '@shopify/cli-kit/node/fs'
import {isStdinPiped, readStdinString} from '@shopify/cli-kit/node/system'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import type {ResolvedApiSchema, SchemaSource} from './engine/schema-source.js'

// The marker file that identifies the graphql reference-data directory (and
// doubles as the version catalog). Shipped once per subcommand data dir.
const VERSION_CATALOG_MARKER = 'supported-versions-schema.json'

/**
 * Reads the GraphQL operation from `--code`, `--file`, or piped stdin (in that
 * order). Exported and injectable so the stdin/TTY guard is unit-testable
 * without touching the real `process.stdin`.
 *
 * A missing `--file` (via {@link readFile}) or an empty/absent stdin throws — the
 * pure core folds that throw into a structured FAILED result rather than letting
 * it crash the command.
 */
export type ReadGraphqlOperation = (input: {code?: string; file?: string}) => Promise<string>

export const readGraphqlOperation: ReadGraphqlOperation = async ({code, file}) => {
  if (code !== undefined) return code
  if (file !== undefined) return readFile(file)

  // Fall back to stdin. `readStdinString` returns undefined when stdin is a TTY
  // or otherwise not piped (per `isStdinPiped`), and trims the piped input.
  const piped = isStdinPiped() ? await readStdinString() : undefined
  if (!piped) {
    throw new AbortError(
      'No GraphQL operation provided.',
      'Pass the operation with --code, --file, or pipe it via stdin.',
    )
  }
  return piped
}

/** The inputs the pure core needs to validate a single operation. */
export interface ValidateGraphqlCoreInput {
  /** GraphQL operation passed via --code. */
  code?: string
  /** Path to a file containing the operation, passed via --file. */
  file?: string
  /** The API to validate against; gated to {@link GRAPHQL_APIS}. */
  api: string
  /** Optional API version; defaults to the API's latest. */
  version?: string
  /** Test seam: points the loader at a fixture data directory. */
  dataDir?: string
  /** Test seam: swaps the whole byte/catalog source. */
  schemaSource?: SchemaSource
  /** Test seam: overrides how the operation is acquired (stdin/file/code). */
  readOperation?: ReadGraphqlOperation
}

/** Everything the command forwards to the orchestrator. */
export interface RunGraphqlValidationOptions extends ValidateGraphqlCoreInput {
  /** Emit the machine-readable JSON payload instead of rendered output. */
  json: boolean
}

/** The structured result of validating one operation, before rendering. */
export interface GraphqlValidationOutcome {
  /** True when the operation is valid (SUCCESS or INFORM). */
  success: boolean
  /** The overall result — drives rendering, telemetry, and the exit code. */
  result: ValidationResult
  /** The response set emitted verbatim in the `--json` payload. */
  responses: ValidationToolResult
  /** The version validated against, when one was resolved. */
  resolvedVersion?: string
  /** Whether the version was defaulted (drives the "Version validated against" note). */
  versionDefaulted: boolean
}

/** Builds a FAILED outcome from a single reason. */
function failedOutcome(
  resultDetail: string,
  resolvedVersion: string | undefined,
  versionDefaulted: boolean,
): GraphqlValidationOutcome {
  return {
    success: false,
    result: ValidationResult.FAILED,
    responses: [{result: ValidationResult.FAILED, resultDetail}],
    resolvedVersion,
    versionDefaulted,
  }
}

/**
 * The pure core: acquires the operation, resolves the version, loads and builds
 * the schema, validates, and appends the required offline access scopes on a
 * pass. It performs no rendering and records no telemetry, so it is trivially
 * unit-testable.
 *
 * Every fallible step — reading the operation, locating the bundled data,
 * reading the version catalog, and validating — is folded into a single
 * try/catch so a bad `--file`, an empty stdin, or a broken install surface as a
 * structured FAILED result rather than an unhandled crash.
 */
export async function validateGraphql(input: ValidateGraphqlCoreInput): Promise<GraphqlValidationOutcome> {
  const {api, version} = input
  const readOperation = input.readOperation ?? readGraphqlOperation

  if (!isGraphqlApi(api)) {
    return failedOutcome(`Unsupported API '${api}'. Supported APIs: ${GRAPHQL_APIS.join(', ')}.`, undefined, false)
  }

  let resolvedVersion: string | undefined
  try {
    const operation = await readOperation({code: input.code, file: input.file})

    const dataDir = input.dataDir ?? resolveValidateDataDir('graphql', [VERSION_CATALOG_MARKER])
    const schemaSource = input.schemaSource ?? createDiskSchemaSource(dataDir)
    const catalog = schemaSource.readVersionCatalog()

    const resolution = resolveVersion(catalog, api, version)
    if (!resolution.ok) {
      const detail =
        resolution.reason === 'unsupported_version'
          ? `Version '${version}' is not available for API '${api}'. Available versions for '${api}': ${resolution.supportedVersions.join(', ')}.`
          : `No supported versions available for API '${api}'.`
      return failedOutcome(detail, undefined, false)
    }

    resolvedVersion = resolution.version
    const versionDefaulted = resolution.source === 'default'
    const apiVersion: ResolvedApiSchema = {
      api,
      name: resolvedVersion,
      schemaPath: schemaPathFor(dataDir, api, resolvedVersion),
      latestVersion: versionDefaulted,
    }

    const {validation, scopes} = await validateGraphQLOperation(operation, api, {
      apiVersion,
      failOnDeprecated: false,
      schemaSource,
    })

    // On a pass (SUCCESS or INFORM), append the offline access scopes the
    // operation requires — the feature unique to graphql validation.
    let resultDetail = validation.resultDetail
    if (validation.result !== ValidationResult.FAILED && scopes.length > 0) {
      resultDetail += formatScopes(scopes)
    }

    return {
      success: validation.result !== ValidationResult.FAILED,
      result: validation.result,
      responses: [{result: validation.result, resultDetail}],
      resolvedVersion,
      versionDefaulted,
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // Any acquisition, packaging, or schema-load failure becomes a structured
    // FAILED response so JSON consumers still receive the standard payload shape.
    const detail = error instanceof Error ? error.message : String(error)
    return failedOutcome(detail, resolvedVersion, false)
  }
}

/**
 * The human-readable body: the result detail (which already carries the
 * offline-scopes note) plus the defaulted-version note. Deliberately a plain
 * tokenized string — never the raw markdown summary — so the rendered box stays
 * clean.
 */
function humanBody(outcome: GraphqlValidationOutcome): string {
  const detail = outcome.responses[0]?.resultDetail ?? ''
  const versionNote =
    outcome.versionDefaulted && outcome.resolvedVersion !== undefined
      ? `\nVersion validated against is ${outcome.resolvedVersion}.`
      : ''
  return `${detail}${versionNote}`
}

/**
 * Renders the outcome and sets the exit status. JSON mode emits the
 * `{success, responses, resolvedVersion?}` payload (pretty-printed, matching the
 * `app config validate` idiom); human mode renders a tokenized body through
 * cli-kit UI. A non-success outcome exits non-zero via AbortSilentError.
 */
export function renderGraphqlOutcome(outcome: GraphqlValidationOutcome, options: {json: boolean}): void {
  if (options.json) {
    outputResult(
      JSON.stringify(
        {
          success: outcome.success,
          responses: outcome.responses,
          resolvedVersion: outcome.resolvedVersion,
        },
        null,
        2,
      ),
    )
  } else {
    const body = humanBody(outcome)
    if (outcome.result === ValidationResult.SUCCESS) {
      renderSuccess({headline: 'GraphQL operation is valid.', body})
    } else if (outcome.result === ValidationResult.INFORM) {
      renderWarning({headline: 'GraphQL operation is valid, with warnings.', body})
    } else {
      renderError({headline: 'GraphQL validation failed.', body})
    }
  }

  if (!outcome.success) {
    throw new AbortSilentError()
  }
}

/**
 * The thin orchestrator called by the command: validates via the pure core,
 * records telemetry, and renders the result (throwing for a non-zero exit on
 * failure).
 */
export async function runGraphqlValidation(options: RunGraphqlValidationOptions): Promise<void> {
  const outcome = await validateGraphql(options)

  await recordValidateMetadata({
    subcommand: 'graphql',
    result: outcome.result,
    api: options.api,
    apiVersion: outcome.resolvedVersion,
    json: options.json,
  })

  renderGraphqlOutcome(outcome, {json: options.json})
}

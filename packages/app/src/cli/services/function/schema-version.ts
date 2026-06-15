import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputContent, outputDebug, outputToken} from '@shopify/cli-kit/node/output'

/**
 * Marker used in the leading comments of `schema.graphql` to record the
 * `api_version` the schema was fetched for. Format: `# api_version: <version>`.
 */
export const SCHEMA_VERSION_MARKER_PREFIX = '# api_version: '

/**
 * Prepends a versioned header to a schema definition. The header documents
 * which `api_version` the schema was generated for so subsequent builds can
 * detect when the on-disk schema is stale.
 */
export function prependSchemaVersionHeader(definition: string, apiVersion: string): string {
  return `${SCHEMA_VERSION_MARKER_PREFIX}${apiVersion}\n\n${definition}`
}

/**
 * Reads the `api_version` recorded in the leading comments of a schema file.
 * Returns `undefined` if the file does not have the marker (e.g. hand-authored
 * schemas, or schemas generated before this header existed).
 */
export async function readSchemaApiVersion(filePath: string): Promise<string | undefined> {
  if (!(await fileExists(filePath))) {
    outputDebug(`Could not determine api_version: schema file not found at ${filePath}.`)
    return undefined
  }

  const contents = await readFile(filePath)
  // The marker is always written as the first line by `prependSchemaVersionHeader`.
  const firstLine = contents.split('\n', 1)[0]!
  if (firstLine.startsWith(SCHEMA_VERSION_MARKER_PREFIX)) {
    return firstLine.slice(SCHEMA_VERSION_MARKER_PREFIX.length).trim()
  }

  outputDebug(
    `Could not determine api_version from ${filePath}: missing '${SCHEMA_VERSION_MARKER_PREFIX}' marker on the first line.`,
  )
  return undefined
}

/**
 * Validates that `<extension>/schema.graphql` matches the `api_version`
 * declared in the extension TOML. Throws an `AbortError` with a remediation
 * pointing at `shopify app function schema` when the on-disk schema is stale.
 *
 * Silently no-ops when:
 *   - the schema file does not exist (handled by codegen / out of scope here)
 *   - the schema file has no version marker (hand-authored schema, or one
 *     generated before this header existed)
 */
interface ValidateSchemaApiVersionOptions {
  directory: string
  localIdentifier: string
  apiVersion: string
}

export async function validateSchemaApiVersion({
  directory,
  localIdentifier,
  apiVersion,
}: ValidateSchemaApiVersionOptions): Promise<void> {
  const schemaPath = joinPath(directory, 'schema.graphql')
  const versionFromSchema = await readSchemaApiVersion(schemaPath)
  if (versionFromSchema === undefined) return
  if (versionFromSchema === apiVersion) return

  throw new AbortError(
    outputContent`The ${outputToken.cyan(
      'schema.graphql',
    )} file for ${outputToken.cyan(localIdentifier)} was generated for api_version ${outputToken.yellow(
      versionFromSchema,
    )} but your function is now on api_version ${outputToken.yellow(apiVersion)}.`,
    outputContent`Run ${outputToken.genericShellCommand('shopify app function schema')} to refresh it.`,
  )
}

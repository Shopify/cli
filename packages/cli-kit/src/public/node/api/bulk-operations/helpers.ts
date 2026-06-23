import {fetchApiVersions} from '../admin.js'
import {AdminSession} from '../../session.js'
import {AbortError} from '../../error.js'
import {outputContent} from '../../output.js'
import {parse} from 'graphql'

/**
 * Normalizes a bulk operation ID to a GID.
 *
 * @param id - A numeric ID or a full GID.
 * @returns The GID form of the ID.
 */
export function normalizeBulkOperationId(id: string): string {
  // If already a GID, return as-is
  if (id.startsWith('gid://')) {
    return id
  }

  // If numeric, convert to GID
  if (/^\d+$/.test(id)) {
    return `gid://shopify/BulkOperation/${id}`
  }

  // Otherwise return as-is (let API handle any errors)
  return id
}

/**
 * Extracts the numeric ID from a bulk operation GID.
 *
 * @param gid - A GID like "gid://shopify/BulkOperation/123".
 * @returns The numeric ID, or the original string if it isn't a recognized GID.
 */
export function extractBulkOperationId(gid: string): string {
  const match = gid.match(/^gid:\/\/shopify\/BulkOperation\/(\d+)$/)
  return match?.[1] ?? gid
}

/**
 * Validates that a GraphQL document contains exactly one operation definition.
 *
 * @param graphqlOperation - The GraphQL query or mutation string to validate.
 * @throws AbortError if the document doesn't contain exactly one operation or has syntax errors.
 */
export function validateSingleOperation(graphqlOperation: string): void {
  let document
  try {
    document = parse(graphqlOperation)
  } catch (error) {
    if (error instanceof Error) {
      throw new AbortError(`Invalid GraphQL syntax: ${error.message}`)
    }
    throw error
  }

  const operationDefinitions = document.definitions.filter((def) => def.kind === 'OperationDefinition')

  if (operationDefinitions.length !== 1) {
    throw new AbortError(
      'GraphQL document must contain exactly one operation definition. Multiple operations are not supported.',
    )
  }
}

/**
 * Checks if a GraphQL operation is a mutation.
 *
 * @param graphqlOperation - The GraphQL query or mutation string to check.
 * @returns True if the operation is a mutation, false otherwise.
 * @throws AbortError if the operation has invalid GraphQL syntax.
 */
export function isMutation(graphqlOperation: string): boolean {
  let document
  try {
    document = parse(graphqlOperation)
  } catch (error) {
    if (error instanceof Error) {
      throw new AbortError(`Invalid GraphQL syntax: ${error.message}`)
    }
    throw error
  }

  const operationDefinition = document.definitions.find((def) => def.kind === 'OperationDefinition')

  return operationDefinition?.operation === 'mutation'
}

/**
 * Options for resolving an API version.
 */
interface ResolveApiVersionOptions {
  /** Admin session containing store credentials. */
  adminSession: AdminSession
  /** The API version specified by the user. */
  userSpecifiedVersion?: string
  /** Optional minimum version to use as a fallback when no version is specified. */
  minimumDefaultVersion?: string
}

/**
 * Determines the API version to use based on the user provided version and the available versions.
 * The 'unstable' version is always allowed without validation.
 *
 * @param options - Options for resolving the API version.
 * @returns The resolved API version.
 * @throws AbortError if the provided version is not allowed.
 */
export async function resolveApiVersion(options: ResolveApiVersionOptions): Promise<string> {
  const {adminSession, userSpecifiedVersion, minimumDefaultVersion} = options

  if (userSpecifiedVersion === 'unstable') return userSpecifiedVersion

  const availableVersions = await fetchApiVersions(adminSession)

  if (!userSpecifiedVersion) {
    // Return the most recent supported version, or minimumDefaultVersion if specified, whichever is newer.
    const supportedVersions = availableVersions.filter((version) => version.supported).map((version) => version.handle)
    if (minimumDefaultVersion) {
      supportedVersions.push(minimumDefaultVersion)
    }

    return supportedVersions.sort().reverse()[0]!
  }

  // Check if the user provided version is allowed. Unsupported versions (RC) are allowed here.
  const versionList = availableVersions.map((version) => version.handle)
  if (versionList.includes(userSpecifiedVersion)) return userSpecifiedVersion

  // Invalid user provided version.
  const firstLine = outputContent`Invalid API version: ${userSpecifiedVersion}`.value
  const secondLine = outputContent`Allowed versions: ${versionList.join(', ')}`.value
  throw new AbortError(firstLine, secondLine)
}

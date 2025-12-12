import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp, AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
import {parse} from 'graphql'

/**
 * Creates an Admin API session authenticated as an app using client credentials.
 *
 * @param remoteApp - The organization app containing API credentials.
 * @param storeFqdn - The fully qualified domain name of the store.
 * @returns Admin session for making authenticated API requests.
 */
export async function createAdminSessionAsApp(remoteApp: OrganizationApp, storeFqdn: string): Promise<AdminSession> {
  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  return ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)
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
 * Options for resolving an API version.
 */
interface ResolveApiVersionOptions {
  /** Admin session containing store credentials. */
  adminSession: {token: string; storeFqdn: string}
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

/**
 * Creates formatted info list items for GraphQL operations.
 * Includes organization, app, store, and optionally API version information.
 *
 * @param options - The operation context information
 * @returns Array of formatted strings for display
 */
export function formatOperationInfo(options: {
  organization: {businessName: string}
  remoteApp: {title: string}
  storeFqdn: string
  version?: string
}): string[] {
  const {organization, remoteApp, storeFqdn, version} = options

  const items = [`Organization: ${organization.businessName}`, `App: ${remoteApp.title}`, `Store: ${storeFqdn}`]

  if (version) {
    items.push(`API version: ${version}`)
  }

  return items
}

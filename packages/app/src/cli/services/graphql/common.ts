import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp, AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
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
 * Validates that the specified API version is supported by the store.
 * The 'unstable' version is always allowed without validation.
 *
 * @param adminSession - Admin session containing store credentials.
 * @param version - The API version to validate.
 * @throws AbortError if the version is not supported by the store.
 */
export async function validateApiVersion(
  adminSession: {token: string; storeFqdn: string},
  version: string,
): Promise<void> {
  if (version === 'unstable') return

  const supportedVersions = await supportedApiVersions(adminSession)
  if (supportedVersions.includes(version)) return

  const firstLine = outputContent`Invalid API version: ${version}`.value
  const secondLine = outputContent`Supported versions: ${supportedVersions.join(', ')}`.value

  throw new AbortError(`${firstLine}\n${secondLine}`)
}

/**
 * Creates formatted info list items for GraphQL operations.
 * Includes organization, app, store, and API version information.
 *
 * @param options - The operation context information
 * @returns Array of formatted strings for display
 */
export function formatOperationInfo(options: {
  organization: {businessName: string}
  remoteApp: {title: string}
  storeFqdn: string
  version?: string
  showVersion?: boolean
}): string[] {
  const {organization, remoteApp, storeFqdn, version, showVersion = true} = options

  const items = [`Organization: ${organization.businessName}`, `App: ${remoteApp.title}`, `Store: ${storeFqdn}`]

  if (showVersion) {
    items.push(`API version: ${version ?? 'default (latest stable)'}`)
  }

  return items
}

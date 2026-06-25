import {OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp, AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {isMutation, validateSingleOperation, resolveApiVersion} from '@shopify/cli-kit/node/api/bulk-operations'

// Generic GraphQL operation helpers live in the shared cli-kit bulk-operations engine; re-export
// them here so existing app call sites keep a single import surface without duplicating logic.
export {isMutation, validateSingleOperation, resolveApiVersion}

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

/**
 * Validates that mutations can only be executed on dev stores.
 *
 * @param graphqlOperation - The GraphQL operation to validate.
 * @param store - The store where the operation will be executed.
 * @throws AbortError if attempting to run a mutation on a non-dev store.
 */
export function validateMutationStore(graphqlOperation: string, store: OrganizationStore): void {
  if (isMutation(graphqlOperation) && store.storeType !== 'APP_DEVELOPMENT') {
    throw new AbortError(`Mutations can only be executed on dev stores.`)
  }
}

import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp, AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
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

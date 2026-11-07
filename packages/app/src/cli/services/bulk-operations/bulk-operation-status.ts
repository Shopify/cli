import {resolveApiVersion} from '../graphql/common.js'
import {OrganizationApp} from '../../models/organization.js'
import {
  BULK_OPERATIONS_MIN_API_VERSION,
  fetchBulkOperationById,
  fetchRecentBulkOperations,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {BugError} from '@shopify/cli-kit/node/error'
import type {BulkOperationStatusResult} from './types.js'

interface ListBulkOperationsOptions {
  storeFqdn: string
  remoteApp: OrganizationApp
}

interface GetBulkOperationStatusOptions extends ListBulkOperationsOptions {
  operationId: string
}

export async function getBulkOperationStatus(
  options: GetBulkOperationStatusOptions,
): Promise<BulkOperationStatusResult> {
  const {storeFqdn, operationId, remoteApp} = options
  const {adminSession, version} = await prepareStatusContext(storeFqdn, remoteApp)
  const operation = await fetchBulkOperationById({adminSession, operationId, version})

  return {store: storeFqdn, apiVersion: version, operationId, operation: operation ?? null}
}

export async function listBulkOperations(options: ListBulkOperationsOptions): Promise<BulkOperationStatusResult> {
  const {storeFqdn, remoteApp} = options
  const {adminSession, version} = await prepareStatusContext(storeFqdn, remoteApp)
  const operations = await fetchRecentBulkOperations({adminSession, version})

  return {store: storeFqdn, apiVersion: version, operations}
}

async function prepareStatusContext(storeFqdn: string, remoteApp: OrganizationApp) {
  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)
  const version = await resolveApiVersion({adminSession, minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION})
  return {adminSession, version}
}

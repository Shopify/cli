import {createAdminSessionAsApp} from '../graphql/common.js'
import {OrganizationApp} from '../../models/organization.js'
import {BULK_OPERATIONS_MIN_API_VERSION, cancelBulkOperationRequest} from '@shopify/cli-kit/node/api/bulk-operations'
import type {CancelBulkOperationResult} from './types.js'

interface CancelBulkOperationOptions {
  storeFqdn: string
  operationId: string
  remoteApp: OrganizationApp
}

export async function cancelBulkOperation(options: CancelBulkOperationOptions): Promise<CancelBulkOperationResult> {
  const {storeFqdn, operationId, remoteApp} = options
  const adminSession = await createAdminSessionAsApp(remoteApp, storeFqdn)
  const response = await cancelBulkOperationRequest({adminSession, operationId})

  return {
    store: storeFqdn,
    apiVersion: BULK_OPERATIONS_MIN_API_VERSION,
    operation: response?.bulkOperation ?? null,
    userErrors: response?.userErrors ?? [],
  }
}

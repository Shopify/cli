import {Shop, Organization} from '../../../apis/destinations/index.js'
import {ApiClientInterface} from '../types/api-client.js'

export function findShop(shopDomain: string, orgs: Organization[]): Shop | undefined {
  const allShops = orgs.flatMap((org) => org.shops)
  return allShops.find((shop) => shop.domain === shopDomain)
}

export async function ensureOrgHasBulkDataAccess(
  organizationId: string,
  token: string,
  apiClient: ApiClientInterface,
): Promise<boolean> {
  try {
    const fakeOperationId = '99999999999999999999999999999999'
    await apiClient.pollBulkDataOperation(organizationId, fakeOperationId, token)

    return true
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Field 'bulkData' doesn't exist on type 'Organization'")) {
        return false
      }
      if (error.message.includes('Invalid BulkDataOperationID')) {
        return true
      }
      if (error.message.includes('BulkDataOperation not found')) {
        return true
      }
    }
    throw error
  }
}

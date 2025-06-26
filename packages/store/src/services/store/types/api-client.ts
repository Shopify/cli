import {Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'

export interface ApiClientInterface {
  fetchOrganizations(session: string): Promise<Organization[]>

  startBulkDataStoreCopy(
    organizationId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse>

  pollBulkDataOperation(
    organizationId: string,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse>

  ensureAuthenticatedBusinessPlatform(): Promise<string>
}

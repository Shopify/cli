import {Shop} from '../../../apis/admin/types.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'
import {StoreIdentifier} from '../../../apis/organizations/index.js'
import {ResourceConfigs} from '../../../lib/types.js'
import {Organization} from '../../../apis/destinations/index.js'

export interface ApiClientInterface {
  getStoreDetails(storeDomain: string): Promise<Shop>

  startBulkDataStoreCopy(
    identifier: StoreIdentifier,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse>

  startBulkDataStoreExport(
    identifier: StoreIdentifier,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse>

  startBulkDataStoreImport(
    identifier: StoreIdentifier,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse>

  pollBulkDataOperation(
    identifier: StoreIdentifier,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse>

  fetchOrgs(token: string): Promise<Organization[]>

  ensureAuthenticatedBusinessPlatform(): Promise<string>
}

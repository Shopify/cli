import {Shop} from '../../../apis/admin/types.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'

export interface ApiClientInterface {
  getStoreDetails(storeDomain: string): Promise<Shop>

  startBulkDataStoreCopy(
    shopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse>

  startBulkDataStoreExport(
    shopId: string,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse>

  startBulkDataStoreImport(
    shopId: string,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse>

  pollBulkDataOperation(shopId: string, operationId: string, token: string): Promise<BulkDataOperationByIdResponse>

  ensureAuthenticatedBusinessPlatform(): Promise<string>
}

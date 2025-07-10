import {ApiClientInterface} from '../types/api-client.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'
import {
  startBulkDataStoreCopy,
  startBulkDataStoreExport,
  startBulkDataStoreImport,
  pollBulkDataOperation,
} from '../../../apis/organizations/index.js'
import {getShopDetails} from '../../../apis/admin/index.js'
import {Shop} from '../../../apis/admin/types.js'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'

export class ApiClient implements ApiClientInterface {
  async getStoreDetails(storeDomain: string): Promise<Shop> {
    return getShopDetails(storeDomain)
  }

  async startBulkDataStoreCopy(
    shopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    return startBulkDataStoreCopy(
      shopId,
      sourceShopDomain,
      targetShopDomain,
      resourceConfigs,
      token,
      this.createUnauthorizedHandler(),
    )
  }

  async startBulkDataStoreExport(
    shopId: string,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse> {
    return startBulkDataStoreExport(shopId, sourceShopDomain, token, this.createUnauthorizedHandler())
  }

  async startBulkDataStoreImport(
    shopId: string,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse> {
    return startBulkDataStoreImport(
      shopId,
      targetShopDomain,
      importUrl,
      resourceConfigs,
      token,
      this.createUnauthorizedHandler(),
    )
  }

  async pollBulkDataOperation(
    shopId: string,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    return pollBulkDataOperation(shopId, operationId, token, this.createUnauthorizedHandler())
  }

  async ensureAuthenticatedBusinessPlatform(): Promise<string> {
    return ensureAuthenticatedBusinessPlatform()
  }

  private createUnauthorizedHandler(): UnauthorizedHandler {
    return {
      type: 'token_refresh',
      handler: async () => {
        const newToken = await this.ensureAuthenticatedBusinessPlatform()
        return {token: newToken}
      },
    }
  }
}

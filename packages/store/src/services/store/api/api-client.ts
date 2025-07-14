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
import {OperationError, ValidationError, ErrorCodes} from '../errors/errors.js'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {ClientError} from 'graphql-request'

export class ApiClient implements ApiClientInterface {
  async getStoreDetails(storeDomain: string): Promise<Shop> {
    try {
      return await getShopDetails(storeDomain)
    } catch (error) {
      throw this.handleError(error, 'getStoreDetails')
    }
  }

  async startBulkDataStoreCopy(
    shopId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    try {
      return await startBulkDataStoreCopy(
        shopId,
        sourceShopDomain,
        targetShopDomain,
        resourceConfigs,
        token,
        this.createUnauthorizedHandler(),
      )
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreCopy')
    }
  }

  async startBulkDataStoreExport(
    shopId: string,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse> {
    try {
      return await startBulkDataStoreExport(shopId, sourceShopDomain, token, this.createUnauthorizedHandler())
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreExport')
    }
  }

  async startBulkDataStoreImport(
    shopId: string,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse> {
    try {
      return await startBulkDataStoreImport(
        shopId,
        targetShopDomain,
        importUrl,
        resourceConfigs,
        token,
        this.createUnauthorizedHandler(),
      )
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreImport')
    }
  }

  async pollBulkDataOperation(
    shopId: string,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    try {
      return await pollBulkDataOperation(shopId, operationId, token, this.createUnauthorizedHandler())
    } catch (error) {
      throw this.handleError(error, 'pollBulkDataOperation')
    }
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

  private handleError(error: unknown, operationName: string): OperationError | ValidationError {
    if (error instanceof OperationError || error instanceof ValidationError) {
      return error
    }
    if (error instanceof ClientError) {
      const requestId = this.extractRequestIdFromError(error)
      return new OperationError(operationName, ErrorCodes.GRAPHQL_API_ERROR, {}, requestId)
    }
    throw error
  }

  private extractRequestIdFromError(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as {response?: {headers?: {get?: (key: string) => string | null}}}).response
      if (response && response.headers && typeof response.headers.get === 'function') {
        return response.headers.get('x-request-id') ?? undefined
      }
    }
    return undefined
  }
}

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
  StoreIdentifier,
} from '../../../apis/organizations/index.js'
import {getShopDetails} from '../../../apis/admin/index.js'
import {Shop} from '../../../apis/admin/types.js'
import {OperationError, ValidationError, ErrorCodes} from '../errors/errors.js'
import {fetchOrgs, Organization} from '../../../apis/destinations/index.js'
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
    identifier: StoreIdentifier,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    try {
      return await startBulkDataStoreCopy(
        identifier,
        sourceShopDomain,
        targetShopDomain,
        resourceConfigs,
        token,
        this.createUnauthorizedHandler(),
      )
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreCopy', {
        sourceStoreName: sourceShopDomain,
        targetStoreName: targetShopDomain,
      })
    }
  }

  async startBulkDataStoreExport(
    identifier: StoreIdentifier,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse> {
    try {
      return await startBulkDataStoreExport(identifier, sourceShopDomain, token, this.createUnauthorizedHandler())
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreExport', {
        storeName: sourceShopDomain,
      })
    }
  }

  async startBulkDataStoreImport(
    identifier: StoreIdentifier,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse> {
    try {
      return await startBulkDataStoreImport(
        identifier,
        targetShopDomain,
        importUrl,
        resourceConfigs,
        token,
        this.createUnauthorizedHandler(),
      )
    } catch (error) {
      throw this.handleError(error, 'startBulkDataStoreImport', {
        storeName: targetShopDomain,
      })
    }
  }

  async pollBulkDataOperation(
    identifier: StoreIdentifier,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    try {
      return await pollBulkDataOperation(identifier, operationId, token, this.createUnauthorizedHandler())
    } catch (error) {
      throw this.handleError(error, 'pollBulkDataOperation')
    }
  }

  async fetchOrgs(token: string): Promise<Organization[]> {
    return fetchOrgs(token, this.createUnauthorizedHandler())
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

  private handleError(
    error: unknown,
    operationName: string,
    params?: {[key: string]: string},
  ): OperationError | ValidationError {
    if (error instanceof ClientError) {
      const requestId = this.extractRequestIdFromError(error)
      return new OperationError(operationName, ErrorCodes.GRAPHQL_API_ERROR, params, requestId)
    }

    if (error?.constructor?.name === 'GraphQLClientError') {
      const requestId = this.extractRequestIdFromErrorMessage(error)
      const errors = (error as {errors?: {extensions?: {code?: string; fieldName?: string}}[]})?.errors

      const unauthorizedError = this.handleUnauthorizedError(errors, operationName, params, requestId)
      if (unauthorizedError) {
        return unauthorizedError
      }

      if (this.isMissingEAAccess(errors)) {
        return new OperationError(operationName, ErrorCodes.MISSING_EA_ACCESS, params, requestId)
      }

      return new OperationError(operationName, ErrorCodes.GRAPHQL_API_ERROR, params, requestId)
    }

    throw error
  }

  private isMissingEAAccess(errors?: {extensions?: {code?: string; fieldName?: string}}[]): boolean {
    return (
      errors?.some(
        (err) => err.extensions?.code === 'undefinedField' && err.extensions?.fieldName?.includes('bulkDataStore'),
      ) ?? false
    )
  }

  private handleUnauthorizedError(
    errors: {extensions?: {code?: string}}[] | undefined,
    operationName: string,
    params?: {[key: string]: string},
    requestId?: string,
  ): OperationError | null {
    const isUnauthorized = errors?.some((err) => err.extensions?.code === 'UNAUTHORIZED') ?? false
    if (!isUnauthorized) {
      return null
    }

    if (operationName === 'startBulkDataStoreExport') {
      return new OperationError(operationName, ErrorCodes.UNAUTHORIZED_EXPORT, params, requestId)
    } else if (operationName === 'startBulkDataStoreImport') {
      return new OperationError(operationName, ErrorCodes.UNAUTHORIZED_IMPORT, params, requestId)
    } else if (operationName === 'startBulkDataStoreCopy') {
      return new OperationError(operationName, ErrorCodes.UNAUTHORIZED_COPY, params, requestId)
    }
    return new OperationError(operationName, ErrorCodes.UNAUTHORIZED, params, requestId)
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

  private extractRequestIdFromErrorMessage(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as {message?: string}).message
      if (message) {
        return message.match(/Request ID: ([\w-]+)/)?.[1] ?? undefined
      }
    }
    return undefined
  }
}

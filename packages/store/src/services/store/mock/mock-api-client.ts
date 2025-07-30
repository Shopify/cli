import {TEST_COPY_START_RESPONSE, TEST_COMPLETED_OPERATION, TEST_ALL_SHOPS} from './mock-data.js'
import {MOCK_CONFIG} from './mock-config.js'
import {ApiClientInterface} from '../types/api-client.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'

import {ResourceConfigs} from '../../../lib/types.js'
import {Shop} from '../../../apis/admin/types.js'
import { Organization } from '../../../apis/destinations/index.js'

export class MockApiClient implements ApiClientInterface {
  private pollCount = 0

  async getStoreDetails(storeDomain: string): Promise<Shop> {
    await this.delay(MOCK_CONFIG.API_DELAY)

    const shop = TEST_ALL_SHOPS.find((shop) => shop.domain === storeDomain)
    if (!shop) {
      throw new Error(`Shop not found: ${storeDomain}`)
    }
    return {id: shop.id, name: shop.name}
  }

  async startBulkDataStoreCopy(
    _shopId: string,
    _sourceShopDomain: string,
    _targetShopDomain: string,
    _resourceConfigs: ResourceConfigs,
    _token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    this.pollCount = 0
    return TEST_COPY_START_RESPONSE
  }

  async startBulkDataStoreExport(
    _shopId: string,
    _sourceShopDomain: string,
    _token: string,
  ): Promise<BulkDataStoreExportStartResponse> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    this.pollCount = 0
    return {
      bulkDataStoreExportStart: {
        success: true,
        operation: {
          id: 'mock-export-operation-id',
          operationType: 'STORE_EXPORT',
          status: 'IN_PROGRESS',
        },
        userErrors: [],
      },
    }
  }

  async startBulkDataStoreImport(
    _shopId: string,
    _targetShopDomain: string,
    _importUrl: string,
    _resourceConfigs: ResourceConfigs,
    _token: string,
  ): Promise<BulkDataStoreImportStartResponse> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    this.pollCount = 0
    return {
      bulkDataStoreImportStart: {
        success: true,
        operation: {
          id: 'mock-import-operation-id',
          operationType: 'STORE_IMPORT',
          status: 'IN_PROGRESS',
        },
        userErrors: [],
      },
    }
  }

  async pollBulkDataOperation(
    _shopId: string,
    _operationId: string,
    _token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    this.pollCount++
    const isComplete = this.pollCount > MOCK_CONFIG.POLLING_ITERATIONS_BEFORE_COMPLETE

    await this.delay(MOCK_CONFIG.API_DELAY)

    if (isComplete) {
      return TEST_COMPLETED_OPERATION
    }

    return {
      ...TEST_COMPLETED_OPERATION,
      organization: {
        ...TEST_COMPLETED_OPERATION.organization,
        bulkData: {
          ...TEST_COMPLETED_OPERATION.organization.bulkData,
          operation: {
            ...TEST_COMPLETED_OPERATION.organization.bulkData.operation,
            status: 'IN_PROGRESS',
            storeOperations: TEST_COMPLETED_OPERATION.organization.bulkData.operation.storeOperations.map((op) => ({
              ...op,
              remoteOperationStatus: 'IN_PROGRESS',
              completedObjectCount: Math.floor(op.totalObjectCount / 2),
            })),
          },
        },
      },
    }
  }

  async fetchOrgs(_token: string): Promise<Organization[]> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    return [
      {
        id: 'org-1',
        name: 'Org 1',
        shops: TEST_ALL_SHOPS,
      },
    ]
  }

  async ensureAuthenticatedBusinessPlatform(): Promise<string> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    return 'mock-session-token'
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

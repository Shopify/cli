import {TEST_MOCK_DATA, TEST_COPY_START_RESPONSE, TEST_COMPLETED_OPERATION} from './mock-data.js'
import {MOCK_CONFIG} from './mock-config.js'
import {ApiClientInterface} from '../types/api-client.js'
import {Organization} from '../../../apis/destinations/index.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'

export class MockApiClient implements ApiClientInterface {
  private pollCount = 0

  async fetchOrganizations(_session: string): Promise<Organization[]> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    return [TEST_MOCK_DATA.organization, TEST_MOCK_DATA.differentOrganization]
  }

  async startBulkDataStoreCopy(
    _organizationId: string,
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
    _organizationId: string,
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
          operationType: 'EXPORT',
          status: 'IN_PROGRESS',
        },
        userErrors: [],
      },
    }
  }

  async startBulkDataStoreImport(
    _organizationId: string,
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
          operationType: 'IMPORT',
          status: 'IN_PROGRESS',
        },
        userErrors: [],
      },
    }
  }

  async pollBulkDataOperation(
    _organizationId: string,
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

  async ensureAuthenticatedBusinessPlatform(): Promise<string> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    return 'mock-session-token'
  }

  async ensureUserHasBulkDataAccess(_organizationId: string, _token: string): Promise<boolean> {
    await this.delay(MOCK_CONFIG.API_DELAY)
    return true
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

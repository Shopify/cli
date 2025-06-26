import {TEST_MOCK_DATA, TEST_COPY_START_RESPONSE, TEST_COMPLETED_OPERATION} from './mock-data.js'
import {MOCK_CONFIG} from './mock-config.js'
import {ApiClientInterface} from '../types/api-client.js'
import {Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'
import {outputInfo} from '@shopify/cli-kit/node/output'

export class MockApiClient implements ApiClientInterface {
  private pollCount = 0

  async fetchOrganizations(_session: string): Promise<Organization[]> {
    outputInfo('[MOCK] Fetching organizations...')
    await this.delay(MOCK_CONFIG.API_DELAY)
    return [TEST_MOCK_DATA.organization]
  }

  async startBulkDataStoreCopy(
    _organizationId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    _resourceConfigs: ResourceConfigs,
    _token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    outputInfo(`[MOCK] Starting bulk data copy from ${sourceShopDomain} to ${targetShopDomain}...`)
    await this.delay(MOCK_CONFIG.API_DELAY)
    this.pollCount = 0
    return TEST_COPY_START_RESPONSE
  }

  async pollBulkDataOperation(
    _organizationId: string,
    operationId: string,
    _token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    this.pollCount++
    const isComplete = this.pollCount > MOCK_CONFIG.POLLING_ITERATIONS_BEFORE_COMPLETE
    const status = isComplete ? 'COMPLETED' : 'IN_PROGRESS'

    outputInfo(
      `[MOCK] Polling operation ${operationId}... (${this.pollCount}/${
        MOCK_CONFIG.POLLING_ITERATIONS_BEFORE_COMPLETE + 1
      }) - Status: ${status}`,
    )
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
    outputInfo('[MOCK] Authenticating with business platform...')
    await this.delay(MOCK_CONFIG.API_DELAY)
    return 'mock-session-token'
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

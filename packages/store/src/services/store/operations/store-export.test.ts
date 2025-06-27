import {StoreExportOperation} from './store-export.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {
  TEST_MOCK_DATA,
  TEST_EXPORT_START_RESPONSE,
  TEST_COMPLETED_EXPORT_OPERATION,
  generateTestFailedExportStartResponse,
} from '../mock/mock-data.js'
import {Shop, Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderSuccess, renderTasks, renderWarning, Task} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('../utils/result-file-handler.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')

describe('StoreExportOperation', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockSourceShop: Shop = TEST_MOCK_DATA.sourceShop
  const mockOrganization: Organization = TEST_MOCK_DATA.organization
  const mockExportStartResponse: BulkDataStoreExportStartResponse = TEST_EXPORT_START_RESPONSE
  const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_EXPORT_OPERATION

  let mockApiClient: any
  let mockResultFileHandler: any
  let operation: StoreExportOperation

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })

    mockApiClient = {
      ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue(mockBpSession),
      fetchOrganizations: vi.fn().mockResolvedValue([mockOrganization]),
      startBulkDataStoreExport: vi.fn().mockResolvedValue(mockExportStartResponse),
      pollBulkDataOperation: vi.fn().mockResolvedValue(mockCompletedOperation),
    }

    mockResultFileHandler = {
      promptAndHandleResultFile: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ResultFileHandler).mockImplementation(() => mockResultFileHandler)

    operation = new StoreExportOperation(mockApiClient)

    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      const ctx = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      return ctx
    })
  })

  test('should instantiate with a mock API client', () => {
    const mockApiClient = new MockApiClient()
    const operation = new StoreExportOperation(mockApiClient)

    expect(operation).toBeDefined()
    expect(operation).toBeInstanceOf(StoreExportOperation)
  })

  test('should instantiate without API client (uses default)', () => {
    const operation = new StoreExportOperation()

    expect(operation).toBeDefined()
    expect(operation).toBeInstanceOf(StoreExportOperation)
  })

  test('should successfully export data from source shop', async () => {
    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(mockApiClient.ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(mockApiClient.fetchOrganizations).toHaveBeenCalledWith(mockBpSession)
    expect(outputInfo).toHaveBeenCalledWith('Exporting data from source.myshopify.com')
    expect(mockApiClient.startBulkDataStoreExport).toHaveBeenCalledWith('org1', 'source.myshopify.com', mockBpSession)
    expect(renderSuccess).toHaveBeenCalledWith({
      body: ['Export operation from', {info: 'source.myshopify.com'}, 'complete'],
    })
    expect(mockResultFileHandler.promptAndHandleResultFile).toHaveBeenCalledWith(
      mockCompletedOperation,
      'export',
      'source.myshopify.com',
    )
  })

  test('should throw error when source shop is not found', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [
          mockSourceShop.id === 'shop1' ? {...mockSourceShop, domain: 'different.myshopify.com'} : mockSourceShop,
        ],
      },
    ])

    await expect(operation.execute('nonexistent.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Source shop (nonexistent.myshopify.com) not found.',
    )
  })

  test('should throw error when organization has no shops', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [],
      },
    ])

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Source shop (source.myshopify.com) not found.',
    )
  })

  test('should filter out organizations with single shop', async () => {
    const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(mockApiClient.startBulkDataStoreExport).toHaveBeenCalled()
  })

  test('should throw error when export operation fails to start', async () => {
    const failedResponse: BulkDataStoreExportStartResponse = generateTestFailedExportStartResponse()
    mockApiClient.startBulkDataStoreExport.mockResolvedValue(failedResponse)

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Failed to start export operation: Invalid export configuration, Export not allowed',
    )
  })

  test('should throw error when export operation status is FAILED', async () => {
    const failedOperation: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            status: 'FAILED',
          },
        },
      },
    }
    mockApiClient.pollBulkDataOperation.mockResolvedValue(failedOperation)

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Export operation failed',
    )
  })

  test('should render warning when export completes with errors', async () => {
    const operationWithErrors: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            storeOperations: [
              ...mockCompletedOperation.organization.bulkData.operation.storeOperations,
              {
                id: 'store-op-2',
                store: {
                  id: 'shop1',
                  name: 'Source Shop',
                },
                remoteOperationType: 'EXPORT',
                remoteOperationStatus: 'FAILED',
                totalObjectCount: 50,
                completedObjectCount: 0,
                url: '',
              },
            ],
          },
        },
      },
    }
    mockApiClient.pollBulkDataOperation.mockResolvedValue(operationWithErrors)

    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Export operation from', {info: 'source.myshopify.com'}, 'completed with', {error: 'errors'}],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('should poll until operation is completed', async () => {
    const inProgressOperation: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            status: 'IN_PROGRESS',
          },
        },
      },
    }

    mockApiClient.pollBulkDataOperation
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(mockCompletedOperation)

    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledTimes(3)
    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledWith('org1', 'export-operation-123', mockBpSession)
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('should throw error when polling returns FAILED status', async () => {
    const inProgressOperation: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            status: 'IN_PROGRESS',
          },
        },
      },
    }
    const failedOperation: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            status: 'FAILED',
          },
        },
      },
    }

    mockApiClient.pollBulkDataOperation
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(failedOperation)

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Export operation failed',
    )
  })

  test('should NOT call ResultFileHandler when export fails', async () => {
    const failedOperation: BulkDataOperationByIdResponse = {
      ...mockCompletedOperation,
      organization: {
        ...mockCompletedOperation.organization,
        bulkData: {
          ...mockCompletedOperation.organization.bulkData,
          operation: {
            ...mockCompletedOperation.organization.bulkData.operation,
            status: 'FAILED',
          },
        },
      },
    }
    mockApiClient.pollBulkDataOperation.mockResolvedValue(failedOperation)

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Export operation failed',
    )

    expect(mockResultFileHandler.promptAndHandleResultFile).not.toHaveBeenCalled()
  })

  test('should use MockApiClient when mock flag is set', async () => {
    const operation = new StoreExportOperation()

    const originalTimeout = setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay: any) => {
      return originalTimeout(fn, Math.min(delay, 100))
    })

    await operation.execute('source.myshopify.com', 'output.sqlite', {mock: true})

    expect(renderSuccess).toHaveBeenCalled()
  }, 10000)

  test('should ignore the toFile parameter', async () => {
    await operation.execute('source.myshopify.com', 'any-value-here.sqlite', {})

    expect(renderSuccess).toHaveBeenCalled()
  })

  test('should call renderTasks with correct task configuration', async () => {
    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(renderTasks).toHaveBeenCalledWith([
      {
        title: 'Starting export from source.myshopify.com',
        task: expect.any(Function),
      },
    ])
  })

  test('should handle multiple user errors correctly', async () => {
    const failedResponse: BulkDataStoreExportStartResponse = {
      bulkDataStoreExportStart: {
        success: false,
        userErrors: [
          {field: 'field1', message: 'Error 1'},
          {field: 'field2', message: 'Error 2'},
          {field: 'field3', message: 'Error 3'},
        ],
        operation: {
          id: '',
          operationType: '',
          status: 'FAILED',
        },
      },
    }
    mockApiClient.startBulkDataStoreExport.mockResolvedValue(failedResponse)

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Failed to start export operation: Error 1, Error 2, Error 3',
    )
  })
})

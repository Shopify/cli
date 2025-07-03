import {StoreExportOperation} from './store-export.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {
  TEST_MOCK_DATA,
  TEST_EXPORT_START_RESPONSE,
  TEST_COMPLETED_EXPORT_OPERATION,
  generateTestFailedExportStartResponse,
} from '../mock/mock-data.js'
import {Shop, Organization} from '../../../apis/destinations/index.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderExportResult} from '../../../prompts/export_results.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderTasks} from '@shopify/cli-kit/node/ui'

vi.mock('../utils/result-file-handler.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../prompts/copy_info.js')
vi.mock('../../../prompts/export_results.js')

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

    operation = new StoreExportOperation(mockBpSession, mockApiClient, [mockOrganization])

    vi.mocked(renderTasks).mockResolvedValue({
      operation: mockCompletedOperation,
      isComplete: true,
    })
  })

  test('should successfully export data from source shop', async () => {
    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(renderCopyInfo).toHaveBeenCalledWith('Export Operation', 'source.myshopify.com', 'output.sqlite')
    expect(renderExportResult).toHaveBeenCalledWith(mockSourceShop, mockCompletedOperation)
    expect(mockResultFileHandler.promptAndHandleResultFile).toHaveBeenCalledWith(
      mockCompletedOperation,
      'export',
      {},
      'output.sqlite',
    )
  })

  test('should throw error when source shop is not found', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [
          {
            ...mockSourceShop,
            domain: 'other-org.myshopify.com',
          },
        ],
      },
    ])

    await expect(operation.execute('nonexistent.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Source shop (nonexistent.myshopify.com) not found in any of the Early Access enabled organizations you have access to.',
    )
  })

  test('should throw error when organization has no shops', async () => {
    operation = new StoreExportOperation(mockBpSession, mockApiClient, [
      {
        ...mockOrganization,
        shops: [],
      },
    ])
    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Source shop (source.myshopify.com) not found in any of the Early Access enabled organizations you have access to.',
    )
  })

  test('should filter out organizations with single shop', async () => {
    const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

    await operation.execute('source.myshopify.com', 'output.sqlite', {})

    expect(renderExportResult).toHaveBeenCalled()
  })

  test('should throw error when export operation fails to start', async () => {
    const failedResponse: BulkDataStoreExportStartResponse = generateTestFailedExportStartResponse()
    mockApiClient.startBulkDataStoreExport.mockResolvedValue(failedResponse)

    vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
      const ctx: any = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      return ctx
    })

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

    vi.mocked(renderTasks).mockResolvedValue({
      operation: failedOperation,
      isComplete: true,
    })

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow('Export failed')
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

    vi.mocked(renderTasks).mockResolvedValue({
      operation: failedOperation,
      isComplete: true,
    })

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow('Export failed')

    expect(mockResultFileHandler.promptAndHandleResultFile).not.toHaveBeenCalled()
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

    vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
      const ctx: any = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      return ctx
    })

    await expect(operation.execute('source.myshopify.com', 'output.sqlite', {})).rejects.toThrow(
      'Failed to start export operation: Error 1, Error 2, Error 3',
    )
  })
})

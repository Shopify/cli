import {StoreExportOperation} from './store-export.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {
  TEST_MOCK_DATA,
  TEST_EXPORT_START_RESPONSE,
  TEST_COMPLETED_EXPORT_OPERATION,
  generateTestFailedExportStartResponse,
} from '../mock/mock-data.js'
import {Shop} from '../../../apis/destinations/index.js'
import {BulkDataStoreExportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderExportResult} from '../../../prompts/export_results.js'
import {OperationError, ErrorCodes} from '../errors/errors.js'
import {confirmExportPrompt} from '../../../prompts/confirm_export.js'
import {renderAsyncOperationStarted} from '../../../prompts/async_operation_started.js'
import {renderAsyncOperationJson} from '../../../prompts/async_operation_json.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'

vi.mock('../utils/result-file-handler.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../../../prompts/copy_info.js')
vi.mock('../../../prompts/export_results.js')
vi.mock('../../../prompts/async_operation_json.js')
vi.mock('../../../prompts/async_operation_started.js')
vi.mock('../../../prompts/confirm_export.js')

describe('StoreExportOperation', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockSourceShop: Shop = TEST_MOCK_DATA.sourceShop
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
      getStoreDetails: vi.fn().mockResolvedValue({id: mockSourceShop.id, name: mockSourceShop.name}),
      ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue(mockBpSession),
      startBulkDataStoreExport: vi.fn().mockResolvedValue(mockExportStartResponse),
      pollBulkDataOperation: vi.fn().mockResolvedValue(mockCompletedOperation),
    }

    mockResultFileHandler = {
      promptAndHandleResultFile: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ResultFileHandler).mockImplementation(() => mockResultFileHandler)

    operation = new StoreExportOperation(mockBpSession, mockApiClient)

    vi.mocked(fileExistsSync).mockReturnValue(false)
  })

  test('should show confirm prompt before export', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(confirmExportPrompt).mockResolvedValue(true)
    await operation.execute('source.myshopify.com', 'export.sqlite', {})

    expect(confirmExportPrompt).toHaveBeenCalledWith('source.myshopify.com', 'export.sqlite', true)
    expect(renderAsyncOperationStarted).toHaveBeenCalled()
  })

  test('should skip confirmation when --no-prompt flag is provided', async () => {
    await operation.execute('source.myshopify.com', 'export.sqlite', {'no-prompt': true})

    expect(confirmExportPrompt).not.toHaveBeenCalled()
    expect(renderAsyncOperationStarted).toHaveBeenCalled()
  })

  test('renders export result when --watch flag is provided', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(confirmExportPrompt).mockResolvedValue(true)

    await operation.execute('source.myshopify.com', 'export.sqlite', {watch: true})
    expect(renderExportResult).toHaveBeenCalled()
  })

  test('renders result in json format when --json flag is provided', async () => {
    vi.mocked(fileExistsSync).mockReturnValue(true)
    vi.mocked(confirmExportPrompt).mockResolvedValue(true)

    await operation.execute('source.myshopify.com', 'export.sqlite', {json: true})
    expect(renderAsyncOperationJson).toHaveBeenCalled()
  })

  test('should successfully export data from source shop', async () => {
    vi.mocked(confirmExportPrompt).mockResolvedValue(true)
    await operation.execute('source.myshopify.com', 'output.sqlite', {watch: true})

    expect(confirmExportPrompt).toHaveBeenCalledWith('source.myshopify.com', 'output.sqlite', false)
    expect(renderCopyInfo).toHaveBeenCalledWith('Export Operation', 'source.myshopify.com', 'output.sqlite')
    expect(renderExportResult).toHaveBeenCalledWith('source.myshopify.com', mockCompletedOperation)
    expect(mockResultFileHandler.promptAndHandleResultFile).toHaveBeenCalledWith(
      mockCompletedOperation,
      'export',
      {watch: true},
      'output.sqlite',
    )
  })

  test('should throw error when export operation fails to start', async () => {
    const failedResponse: BulkDataStoreExportStartResponse = generateTestFailedExportStartResponse()
    mockApiClient.startBulkDataStoreExport.mockResolvedValue(failedResponse)

    const promise = operation.execute('source.myshopify.com', 'output.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'export',
      code: ErrorCodes.BULK_OPERATION_FAILED,
      params: {
        errors: 'Invalid export configuration, Export not allowed',
        operationType: 'export',
      },
    })
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

    const promise = operation.execute('source.myshopify.com', 'output.sqlite', {'no-prompt': true, watch: true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'export',
      code: ErrorCodes.EXPORT_FAILED,
    })
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

    const promise = operation.execute('source.myshopify.com', 'output.sqlite', {'no-prompt': true, watch: true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'export',
      code: ErrorCodes.EXPORT_FAILED,
    })

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

    const promise = operation.execute('source.myshopify.com', 'output.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'export',
      code: ErrorCodes.BULK_OPERATION_FAILED,
      params: {
        errors: 'Error 1, Error 2, Error 3',
        operationType: 'export',
      },
    })
  })

  test('should convert GraphQL ClientError to user-friendly error with request ID', async () => {
    const operationError = new OperationError(
      'startBulkDataStoreExport',
      ErrorCodes.GRAPHQL_API_ERROR,
      {},
      'export-request-xyz789',
    )
    mockApiClient.startBulkDataStoreExport.mockRejectedValue(operationError)

    const promise = operation.execute('source.myshopify.com', 'export.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'startBulkDataStoreExport',
      code: ErrorCodes.GRAPHQL_API_ERROR,
      requestId: 'export-request-xyz789',
    })
  })

  test('should convert GraphQL ClientError to user-friendly error without request ID', async () => {
    const operationError = new OperationError('startBulkDataStoreExport', ErrorCodes.GRAPHQL_API_ERROR)
    mockApiClient.startBulkDataStoreExport.mockRejectedValue(operationError)

    const promise = operation.execute('source.myshopify.com', 'export.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'startBulkDataStoreExport',
      code: ErrorCodes.GRAPHQL_API_ERROR,
    })

    const error = await promise.catch((err) => err)
    expect(error.requestId).toBeUndefined()
    expect(error.code).toBe(ErrorCodes.GRAPHQL_API_ERROR)
  })

  test('should get export-specific unauthorized error from API client', async () => {
    const unauthorizedError = new OperationError(
      'startBulkDataStoreExport',
      ErrorCodes.UNAUTHORIZED_EXPORT,
      {storeName: 'source.myshopify.com'},
      'export-request-unauthorized-123',
    )
    mockApiClient.startBulkDataStoreExport.mockRejectedValue(unauthorizedError)

    const promise = operation.execute('source.myshopify.com', 'export.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'startBulkDataStoreExport',
      code: ErrorCodes.UNAUTHORIZED_EXPORT,
      params: {storeName: 'source.myshopify.com'},
      requestId: 'export-request-unauthorized-123',
    })
  })

  test('should get missing EA access error from API client', async () => {
    const missingEAError = new OperationError(
      'startBulkDataStoreExport',
      ErrorCodes.MISSING_EA_ACCESS,
      {},
      'export-request-ea-123',
    )
    mockApiClient.startBulkDataStoreExport.mockRejectedValue(missingEAError)

    const promise = operation.execute('source.myshopify.com', 'export.sqlite', {'no-prompt': true})
    await expect(promise).rejects.toThrow(OperationError)
    await expect(promise).rejects.toMatchObject({
      operation: 'startBulkDataStoreExport',
      code: ErrorCodes.MISSING_EA_ACCESS,
      requestId: 'export-request-ea-123',
    })
  })
})

import {StoreImportOperation} from './store-import.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {FileUploader} from '../utils/file-uploader.js'
import {MockFileUploader} from '../utils/mock-file-uploader.js'
import {ResultFileHandler} from '../utils/result-file-handler.js'
import {
  TEST_MOCK_DATA,
  TEST_IMPORT_START_RESPONSE,
  TEST_COMPLETED_IMPORT_OPERATION,
  generateTestFailedImportStartResponse,
} from '../mock/mock-data.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {Shop, Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderSuccess, renderTasks, renderWarning, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'

vi.mock('../utils/file-uploader.js')
vi.mock('../utils/mock-file-uploader.js')
vi.mock('../utils/result-file-handler.js')
vi.mock('../../../lib/resource-config.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/fs')

describe('StoreImportOperation', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockTargetShop: Shop = TEST_MOCK_DATA.targetShop
  const mockOrganization: Organization = TEST_MOCK_DATA.organization
  const mockImportStartResponse: BulkDataStoreImportStartResponse = TEST_IMPORT_START_RESPONSE
  const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_IMPORT_OPERATION
  const mockUploadUrl = 'https://mock-staged-uploads.shopify.com/files/database-123.sqlite'

  let mockApiClient: any
  let mockFileUploader: any
  let mockResultFileHandler: any
  let operation: StoreImportOperation

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })

    mockApiClient = {
      ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue(mockBpSession),
      fetchOrganizations: vi.fn().mockResolvedValue([mockOrganization]),
      startBulkDataStoreImport: vi.fn().mockResolvedValue(mockImportStartResponse),
      pollBulkDataOperation: vi.fn().mockResolvedValue(mockCompletedOperation),
    }

    mockFileUploader = {
      uploadSqliteFile: vi.fn().mockResolvedValue(mockUploadUrl),
    }
    vi.mocked(FileUploader).mockImplementation(() => mockFileUploader)

    mockResultFileHandler = {
      promptAndHandleResultFile: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(ResultFileHandler).mockImplementation(() => mockResultFileHandler)

    operation = new StoreImportOperation(mockApiClient)

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(parseResourceConfigFlags).mockReturnValue({})
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(renderTasks).mockImplementation(async (tasks) => {
      const ctx = {}
      const processTask = async (index: number): Promise<void> => {
        if (index < tasks.length) {
          await tasks[index]!.task(ctx, tasks[index]!)
          await processTask(index + 1)
        }
      }
      await processTask(0)
      return ctx
    })
  })

  test('should instantiate with a mock API client', () => {
    const mockApiClient = new MockApiClient()
    const operation = new StoreImportOperation(mockApiClient)

    expect(operation).toBeDefined()
    expect(operation).toBeInstanceOf(StoreImportOperation)
  })

  test('should instantiate without API client (uses default)', () => {
    const operation = new StoreImportOperation()

    expect(operation).toBeDefined()
    expect(operation).toBeInstanceOf(StoreImportOperation)
  })

  test('should successfully import data to target shop', async () => {
    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(fileExists).toHaveBeenCalledWith('input.sqlite')
    expect(mockApiClient.ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(mockApiClient.fetchOrganizations).toHaveBeenCalledWith(mockBpSession)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Import data from input.sqlite to target.myshopify.com?',
      confirmationMessage: 'Yes, import',
      cancellationMessage: 'Cancel',
    })
    expect(mockFileUploader.uploadSqliteFile).toHaveBeenCalledWith('input.sqlite', 'target.myshopify.com')
    expect(outputInfo).toHaveBeenCalledWith('Importing data to target.myshopify.com')
    expect(mockApiClient.startBulkDataStoreImport).toHaveBeenCalledWith(
      'org1',
      'target.myshopify.com',
      mockUploadUrl,
      {},
      mockBpSession,
    )
    expect(renderSuccess).toHaveBeenCalledWith({
      body: ['Import operation to', {info: 'target.myshopify.com'}, 'complete'],
    })
    expect(mockResultFileHandler.promptAndHandleResultFile).toHaveBeenCalledWith(
      mockCompletedOperation,
      'import',
      'target.myshopify.com',
    )
  })

  test('should throw error when input file does not exist', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    await expect(operation.execute('nonexistent.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'File not found: nonexistent.sqlite',
    )

    expect(mockApiClient.ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
  })

  test('should throw error when target shop is not found', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [
          mockTargetShop.id === 'shop2' ? {...mockTargetShop, domain: 'different.myshopify.com'} : mockTargetShop,
        ],
      },
    ])

    await expect(operation.execute('input.sqlite', 'nonexistent.myshopify.com', {})).rejects.toThrow(
      'Target shop (nonexistent.myshopify.com) not found.',
    )
  })

  test('should throw error when organization has no shops', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [],
      },
    ])

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Target shop (target.myshopify.com) not found.',
    )
  })

  test('should filter out organizations with single shop', async () => {
    const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(mockApiClient.startBulkDataStoreImport).toHaveBeenCalled()
  })

  test('should skip confirmation when --skip-confirmation flag is provided', async () => {
    await operation.execute('input.sqlite', 'target.myshopify.com', {skipConfirmation: true})

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(mockApiClient.startBulkDataStoreImport).toHaveBeenCalledWith(
      'org1',
      'target.myshopify.com',
      mockUploadUrl,
      {},
      mockBpSession,
    )
  })

  test('should exit when user cancels confirmation', async () => {
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow('Process exit called')

    expect(outputInfo).toHaveBeenCalledWith('Exiting.')
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(mockFileUploader.uploadSqliteFile).not.toHaveBeenCalled()
    expect(mockApiClient.startBulkDataStoreImport).not.toHaveBeenCalled()
  })

  test('should throw error when import operation fails to start', async () => {
    const failedResponse: BulkDataStoreImportStartResponse = generateTestFailedImportStartResponse()
    mockApiClient.startBulkDataStoreImport.mockResolvedValue(failedResponse)

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Failed to start import operation: Invalid file format, Import not allowed for this store',
    )
  })

  test('should throw error when import operation status is FAILED', async () => {
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

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Import operation failed',
    )
  })

  test('should render warning when import completes with errors', async () => {
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
                  id: 'shop2',
                  name: 'Target Shop',
                },
                remoteOperationType: 'IMPORT',
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

    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(renderWarning).toHaveBeenCalledWith({
      body: ['Import operation to', {info: 'target.myshopify.com'}, 'completed with', {error: 'errors'}],
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

    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledTimes(3)
    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledWith('org1', 'import-operation-123', mockBpSession)
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

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Import operation failed',
    )
  })

  test('should NOT call ResultFileHandler when import fails', async () => {
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

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Import operation failed',
    )

    expect(mockResultFileHandler.promptAndHandleResultFile).not.toHaveBeenCalled()
  })

  test('should use MockApiClient and MockFileUploader when mock flag is set', async () => {
    const operation = new StoreImportOperation()

    const mockMockFileUploader = {
      uploadSqliteFile: vi.fn().mockResolvedValue('https://mock-url.com/file.sqlite'),
    }
    vi.mocked(MockFileUploader).mockImplementation(() => mockMockFileUploader)

    const originalTimeout = setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay: any) => {
      return originalTimeout(fn, Math.min(delay, 100))
    })

    await operation.execute('input.sqlite', 'target.myshopify.com', {mock: true})

    expect(renderSuccess).toHaveBeenCalled()
    expect(MockFileUploader).toHaveBeenCalled()
  }, 10000)

  test('should call renderTasks with correct task configuration', async () => {
    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(renderTasks).toHaveBeenCalledWith([
      {
        title: 'Uploading SQLite file',
        task: expect.any(Function),
      },
      {
        title: 'Starting import to target.myshopify.com',
        task: expect.any(Function),
      },
    ])
  })

  test('should pass resource config flags when provided', async () => {
    const mockResourceConfig = {
      products: {
        identifier: {
          field: 'HANDLE',
        },
      },
    }
    vi.mocked(parseResourceConfigFlags).mockReturnValue(mockResourceConfig)

    await operation.execute('input.sqlite', 'target.myshopify.com', {key: ['products:handle']})

    expect(parseResourceConfigFlags).toHaveBeenCalledWith(['products:handle'])
    expect(mockApiClient.startBulkDataStoreImport).toHaveBeenCalledWith(
      'org1',
      'target.myshopify.com',
      mockUploadUrl,
      mockResourceConfig,
      mockBpSession,
    )
  })

  test('should handle multiple user errors correctly', async () => {
    const failedResponse: BulkDataStoreImportStartResponse = {
      bulkDataStoreImportStart: {
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
    mockApiClient.startBulkDataStoreImport.mockResolvedValue(failedResponse)

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Failed to start import operation: Error 1, Error 2, Error 3',
    )
  })

  test('should validate file before authenticating', async () => {
    vi.mocked(fileExists).mockResolvedValue(false)

    await expect(operation.execute('nonexistent.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'File not found: nonexistent.sqlite',
    )

    expect(fileExists).toHaveBeenCalled()
    expect(mockApiClient.ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
  })

  test('should pass uploaded URL from file upload task to import task', async () => {
    const customUploadUrl = 'https://custom-upload.shopify.com/database.sqlite'
    mockFileUploader.uploadSqliteFile.mockResolvedValue(customUploadUrl)

    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(mockApiClient.startBulkDataStoreImport).toHaveBeenCalledWith(
      'org1',
      'target.myshopify.com',
      customUploadUrl,
      {},
      mockBpSession,
    )
  })
})

import {StoreImportOperation} from './store-import.js'
import {FileUploader} from '../utils/file-uploader.js'
import {
  TEST_MOCK_DATA,
  TEST_IMPORT_START_RESPONSE,
  TEST_COMPLETED_IMPORT_OPERATION,
  generateTestFailedImportStartResponse,
} from '../mock/mock-data.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderImportResult} from '../../../prompts/import_result.js'
import {Shop, Organization} from '../../../apis/destinations/index.js'
import {BulkDataStoreImportStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderTasks, renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {fileExists} from '@shopify/cli-kit/node/fs'

vi.mock('../utils/file-uploader.js')
vi.mock('../utils/mock-file-uploader.js')
vi.mock('../../../lib/resource-config.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('../../../prompts/copy_info.js')
vi.mock('../../../prompts/import_result.js')

describe('StoreImportOperation', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockTargetShop: Shop = TEST_MOCK_DATA.targetShop
  const mockOrganization: Organization = TEST_MOCK_DATA.organization
  const mockImportStartResponse: BulkDataStoreImportStartResponse = TEST_IMPORT_START_RESPONSE
  const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_IMPORT_OPERATION
  const mockUploadUrl = 'https://mock-staged-uploads.shopify.com/files/database-123.sqlite'

  let mockApiClient: any
  let mockFileUploader: any
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

    operation = new StoreImportOperation(mockBpSession, mockApiClient, [mockOrganization])

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(parseResourceConfigFlags).mockReturnValue({})
    vi.mocked(fileExists).mockResolvedValue(true)

    vi.mocked(renderTasks).mockResolvedValue({
      operation: mockCompletedOperation,
      isComplete: true,
      importUrl: mockUploadUrl,
    })
  })

  test('should successfully import data to target shop', async () => {
    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(fileExists).toHaveBeenCalledWith('input.sqlite')
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Import data from input.sqlite to target.myshopify.com?',
      confirmationMessage: 'Yes, import',
      cancellationMessage: 'Cancel',
    })
    expect(renderCopyInfo).toHaveBeenCalledWith('Import Operation', 'input.sqlite', 'target.myshopify.com')
    expect(renderImportResult).toHaveBeenCalledWith(mockTargetShop, mockCompletedOperation)
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
          {
            ...mockTargetShop,
            domain: 'other-org.myshopify.com',
          },
        ],
      },
    ])

    await expect(operation.execute('input.sqlite', 'nonexistent.myshopify.com', {})).rejects.toThrow(
      'Target shop (nonexistent.myshopify.com) not found in any of the Early Access enabled organizations you have access to.',
    )
  })

  test('should throw error when organization has no shops', async () => {
    operation = new StoreImportOperation(mockBpSession, mockApiClient, [
      {
        ...mockOrganization,
        shops: [],
      },
    ])
    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow(
      'Target shop (target.myshopify.com) not found in any of the Early Access enabled organizations you have access to.',
    )
  })

  test('should filter out organizations with single shop', async () => {
    const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

    await operation.execute('input.sqlite', 'target.myshopify.com', {})

    expect(renderImportResult).toHaveBeenCalled()
  })

  test('should skip confirmation when --no-prompt flag is provided', async () => {
    await operation.execute('input.sqlite', 'target.myshopify.com', {'no-prompt': true})

    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(renderImportResult).toHaveBeenCalled()
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

    vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
      const ctx: any = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      return ctx
    })

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

    vi.mocked(renderTasks).mockResolvedValue({
      operation: failedOperation,
      isComplete: true,
      importUrl: mockUploadUrl,
    })

    await expect(operation.execute('input.sqlite', 'target.myshopify.com', {})).rejects.toThrow('Import failed')
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

    vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
      const ctx: any = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      ctx.operation = mockCompletedOperation
      ctx.isComplete = true
      ctx.importUrl = mockUploadUrl
      return ctx
    })

    await operation.execute('input.sqlite', 'target.myshopify.com', {key: ['products:handle']})

    expect(parseResourceConfigFlags).toHaveBeenCalledWith(['products:handle'])
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

    vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
      const ctx: any = {}
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task(ctx, task)
      }
      return ctx
    })

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
})

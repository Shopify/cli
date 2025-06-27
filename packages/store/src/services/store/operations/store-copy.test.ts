import {StoreCopyOperation} from './store-copy.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {
  TEST_MOCK_DATA,
  TEST_COPY_START_RESPONSE,
  TEST_COMPLETED_OPERATION,
  generateTestOperationResponse,
  generateTestOperationWithErrors,
  generateTestFailedStartResponse,
} from '../mock/mock-data.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {Shop, Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderSuccess, renderTasks, renderWarning, Task} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('../../../prompts/confirm_copy.js')
vi.mock('../../../lib/resource-config.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')

describe('StoreCopyOperation', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockSourceShop: Shop = TEST_MOCK_DATA.sourceShop
  const mockTargetShop: Shop = TEST_MOCK_DATA.targetShop
  const mockOrganization: Organization = TEST_MOCK_DATA.organization
  const mockCopyStartResponse: BulkDataStoreCopyStartResponse = TEST_COPY_START_RESPONSE
  const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_OPERATION

  let mockApiClient: any
  let operation: StoreCopyOperation

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })

    mockApiClient = {
      ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue(mockBpSession),
      fetchOrganizations: vi.fn().mockResolvedValue([mockOrganization]),
      startBulkDataStoreCopy: vi.fn().mockResolvedValue(mockCopyStartResponse),
      pollBulkDataOperation: vi.fn().mockResolvedValue(mockCompletedOperation),
    }

    operation = new StoreCopyOperation(mockApiClient)

    vi.mocked(confirmCopyPrompt).mockResolvedValue(true)
    vi.mocked(parseResourceConfigFlags).mockReturnValue({})
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
    const operation = new StoreCopyOperation(mockApiClient)

    expect(operation).toBeDefined()
    expect(operation).toBeInstanceOf(StoreCopyOperation)
  })

  test('should successfully copy data from source to target shop', async () => {
    await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

    expect(mockApiClient.ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(mockApiClient.fetchOrganizations).toHaveBeenCalledWith(mockBpSession)
    expect(confirmCopyPrompt).toHaveBeenCalledWith('source.myshopify.com', 'target.myshopify.com')
    expect(outputInfo).toHaveBeenCalledWith('Copying from source.myshopify.com to target.myshopify.com')
    expect(mockApiClient.startBulkDataStoreCopy).toHaveBeenCalledWith(
      'org1',
      'source.myshopify.com',
      'target.myshopify.com',
      {},
      mockBpSession,
    )
    expect(renderSuccess).toHaveBeenCalledWith({
      body: ['Copy operation from', {info: 'source.myshopify.com'}, 'to', {info: 'target.myshopify.com'}, 'complete'],
    })
  })

  test('should skip confirmation when --skip-confirmation flag is provided', async () => {
    await operation.execute('source.myshopify.com', 'target.myshopify.com', {skipConfirmation: true})

    expect(confirmCopyPrompt).not.toHaveBeenCalled()
    expect(mockApiClient.startBulkDataStoreCopy).toHaveBeenCalledWith(
      'org1',
      'source.myshopify.com',
      'target.myshopify.com',
      {},
      mockBpSession,
    )
  })

  test('should exit when user cancels confirmation', async () => {
    vi.mocked(confirmCopyPrompt).mockResolvedValue(false)

    await expect(operation.execute('source.myshopify.com', 'target.myshopify.com', {})).rejects.toThrow(
      'Process exit called',
    )

    expect(outputInfo).toHaveBeenCalledWith('Exiting.')
    expect(process.exit).toHaveBeenCalledWith(0)
    expect(mockApiClient.startBulkDataStoreCopy).not.toHaveBeenCalled()
  })

  test('should throw error when source shop is not found', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [mockTargetShop],
      },
    ])

    await expect(operation.execute('nonexistent.myshopify.com', 'target.myshopify.com', {})).rejects.toThrow(
      'Source shop (nonexistent.myshopify.com) not found.',
    )
  })

  test('should throw error when target shop is not found', async () => {
    mockApiClient.fetchOrganizations.mockResolvedValue([
      {
        ...mockOrganization,
        shops: [mockSourceShop],
      },
    ])

    await expect(operation.execute('source.myshopify.com', 'nonexistent.myshopify.com', {})).rejects.toThrow(
      'Target shop (nonexistent.myshopify.com) not found.',
    )
  })

  test('should throw error when source and target shops are the same', async () => {
    await expect(operation.execute('source.myshopify.com', 'source.myshopify.com', {})).rejects.toThrow(
      'Source and target shops must not be the same.',
    )
  })

  test('should throw error when shops are in different organizations', async () => {
    const differentOrgShop: Shop = TEST_MOCK_DATA.differentOrgShop
    const differentOrg: Organization = TEST_MOCK_DATA.differentOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, differentOrg])

    await expect(operation.execute('source.myshopify.com', 'different.myshopify.com', {})).rejects.toThrow(
      'Source and target shops must be in the same organization.',
    )
  })

  test('should filter out organizations with single shop', async () => {
    const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
    mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

    await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

    expect(mockApiClient.startBulkDataStoreCopy).toHaveBeenCalled()
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

    await operation.execute('source.myshopify.com', 'target.myshopify.com', {key: ['products:handle']})

    expect(parseResourceConfigFlags).toHaveBeenCalledWith(['products:handle'])
    expect(mockApiClient.startBulkDataStoreCopy).toHaveBeenCalledWith(
      'org1',
      'source.myshopify.com',
      'target.myshopify.com',
      mockResourceConfig,
      mockBpSession,
    )
  })

  test('should throw error when copy operation fails to start', async () => {
    const failedResponse: BulkDataStoreCopyStartResponse = generateTestFailedStartResponse()
    mockApiClient.startBulkDataStoreCopy.mockResolvedValue(failedResponse)

    await expect(operation.execute('source.myshopify.com', 'target.myshopify.com', {})).rejects.toThrow(
      'Failed to start copy operation: Invalid configuration, Insufficient permissions',
    )
  })

  test('should throw error when copy operation status is FAILED', async () => {
    const failedOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('FAILED')
    mockApiClient.pollBulkDataOperation.mockResolvedValue(failedOperation)

    await expect(operation.execute('source.myshopify.com', 'target.myshopify.com', {})).rejects.toThrow(
      'Copy operation failed',
    )
  })

  test('should render warning when copy completes with errors', async () => {
    const operationWithErrors: BulkDataOperationByIdResponse = generateTestOperationWithErrors()
    mockApiClient.pollBulkDataOperation.mockResolvedValue(operationWithErrors)

    await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

    expect(renderWarning).toHaveBeenCalledWith({
      body: [
        'Copy operation from',
        {info: 'source.myshopify.com'},
        'to',
        {info: 'target.myshopify.com'},
        'completed with',
        {error: 'errors'},
      ],
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('should poll until operation is completed', async () => {
    const inProgressOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('IN_PROGRESS')

    mockApiClient.pollBulkDataOperation
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(mockCompletedOperation)

    await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledTimes(3)
    expect(mockApiClient.pollBulkDataOperation).toHaveBeenCalledWith('org1', 'operation-123', mockBpSession)
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('should throw error when polling returns FAILED status', async () => {
    const inProgressOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('IN_PROGRESS')
    const failedOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('FAILED')

    mockApiClient.pollBulkDataOperation
      .mockResolvedValueOnce(inProgressOperation)
      .mockResolvedValueOnce(failedOperation)

    await expect(operation.execute('source.myshopify.com', 'target.myshopify.com', {})).rejects.toThrow(
      'Copy operation failed',
    )
  })

  test('should use MockApiClient when mock flag is set', async () => {
    const operation = new StoreCopyOperation()

    const originalTimeout = setTimeout
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any, delay: any) => {
      return originalTimeout(fn, Math.min(delay, 100))
    })

    await operation.execute('source.myshopify.com', 'target.myshopify.com', {mock: true})

    expect(renderSuccess).toHaveBeenCalled()
  }, 10000)
})

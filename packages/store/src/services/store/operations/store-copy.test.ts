import {StoreCopyOperation} from './store-copy.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {
  TEST_MOCK_DATA,
  TEST_COPY_START_RESPONSE,
  TEST_COMPLETED_OPERATION,
  generateTestOperationResponse,
  generateTestFailedStartResponse,
} from '../mock/mock-data.js'
import {confirmCopyPrompt} from '../../../prompts/confirm_copy.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {renderCopyInfo} from '../../../prompts/copy_info.js'
import {renderCopyResult} from '../../../prompts/copy_result.js'
import {Shop, Organization} from '../../../apis/destinations/index.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ValidationError, OperationError, ErrorCodes} from '../errors/errors.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('../../../prompts/confirm_copy.js')
vi.mock('../../../lib/resource-config.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../../prompts/copy_info.js')
vi.mock('../../../prompts/copy_result.js')

describe('StoreCopyOperation', () => {
  describe('Full integration tests', () => {
    const mockBpSession = 'mock-bp-session-token'
    const mockSourceShop: Shop = TEST_MOCK_DATA.sourceShop
    const mockTargetShop: Shop = TEST_MOCK_DATA.targetShop
    const mockOrganization: Organization = TEST_MOCK_DATA.organization
    const mockCopyStartResponse: BulkDataStoreCopyStartResponse = TEST_COPY_START_RESPONSE
    const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_OPERATION

    let mockApiClient: any
    let operation: StoreCopyOperation
    const mockToken = ''

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

      operation = new StoreCopyOperation(mockToken, mockApiClient, [mockOrganization])

      vi.mocked(confirmCopyPrompt).mockResolvedValue(true)
      vi.mocked(parseResourceConfigFlags).mockReturnValue({})

      // Mock renderTasks to immediately return completed operation
      vi.mocked(renderTasks).mockResolvedValue({
        operation: mockCompletedOperation,
        isComplete: true,
      })
    })

    test('should instantiate with a mock API client', () => {
      const mockApiClient = new MockApiClient()
      const operation = new StoreCopyOperation(mockToken, mockApiClient)

      expect(operation).toBeDefined()
      expect(operation).toBeInstanceOf(StoreCopyOperation)
    })

    test('should instantiate without API client (uses default)', () => {
      const operation = new StoreCopyOperation(mockToken)

      expect(operation).toBeDefined()
      expect(operation).toBeInstanceOf(StoreCopyOperation)
    })

    test('should successfully copy data from source to target shop', async () => {
      await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

      expect(confirmCopyPrompt).toHaveBeenCalledWith('source.myshopify.com', 'target.myshopify.com')
      expect(renderCopyInfo).toHaveBeenCalledWith('Copy Operation', 'source.myshopify.com', 'target.myshopify.com')
      expect(renderCopyResult).toHaveBeenCalledWith(mockSourceShop, mockTargetShop, mockCompletedOperation)
    })

    test('should skip confirmation when --no-prompt flag is provided', async () => {
      await operation.execute('source.myshopify.com', 'target.myshopify.com', {'no-prompt': true})

      expect(confirmCopyPrompt).not.toHaveBeenCalled()
      expect(renderCopyResult).toHaveBeenCalled()
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

      const promise = operation.execute('nonexistent.myshopify.com', 'target.myshopify.com', {})
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.SHOP_NOT_FOUND,
        params: {shop: 'nonexistent.myshopify.com'},
      })
    })

    test('should throw error when target shop is not found', async () => {
      mockApiClient.fetchOrganizations.mockResolvedValue([
        {
          ...mockOrganization,
          shops: [mockSourceShop],
        },
      ])

      const promise = operation.execute('source.myshopify.com', 'nonexistent.myshopify.com', {})
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.SHOP_NOT_FOUND,
        params: {shop: 'nonexistent.myshopify.com'},
      })
    })

    test('should throw error when source and target shops are the same', async () => {
      const promise = operation.execute('source.myshopify.com', 'source.myshopify.com', {})
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.SAME_SHOP,
      })
    })

    test('should throw error when shops are in different organizations', async () => {
      const differentOrgShop: Shop = TEST_MOCK_DATA.differentOrgShop
      const differentOrg: Organization = TEST_MOCK_DATA.differentOrganization
      operation = new StoreCopyOperation(mockToken, mockApiClient, [mockOrganization, differentOrg])
      const promise = operation.execute('source.myshopify.com', 'other-org.myshopify.com', {})
      await expect(promise).rejects.toThrow(ValidationError)
      await expect(promise).rejects.toMatchObject({
        code: ErrorCodes.DIFFERENT_ORG,
      })
    })

    test('should filter out organizations with single shop', async () => {
      const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
      mockApiClient.fetchOrganizations.mockResolvedValue([mockOrganization, singleShopOrg])

      await operation.execute('source.myshopify.com', 'target.myshopify.com', {})

      expect(renderCopyResult).toHaveBeenCalled()
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

      // Mock renderTasks to execute the tasks so parseResourceConfigFlags is called
      vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        ctx.operation = mockCompletedOperation
        ctx.isComplete = true
        return ctx
      })

      await operation.execute('source.myshopify.com', 'target.myshopify.com', {key: ['products:handle']})

      expect(parseResourceConfigFlags).toHaveBeenCalledWith(['products:handle'])
    })

    test('should throw error when copy operation fails to start', async () => {
      const failedResponse: BulkDataStoreCopyStartResponse = generateTestFailedStartResponse()
      mockApiClient.startBulkDataStoreCopy.mockResolvedValue(failedResponse)

      // Mock renderTasks to execute the tasks so the error is thrown
      vi.mocked(renderTasks).mockImplementationOnce(async (tasks: any[]) => {
        const ctx: any = {}
        for (const task of tasks) {
          // eslint-disable-next-line no-await-in-loop
          await task.task(ctx, task)
        }
        return ctx
      })

      const promise = operation.execute('source.myshopify.com', 'target.myshopify.com', {})
      await expect(promise).rejects.toThrow(OperationError)
      await expect(promise).rejects.toMatchObject({
        operation: 'copy',
        code: ErrorCodes.BULK_OPERATION_FAILED,
        params: {
          errors: 'Invalid configuration, Insufficient permissions',
          operationType: 'copy',
        },
      })
    })

    test('should throw error when copy operation status is FAILED', async () => {
      const failedOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('FAILED')

      vi.mocked(renderTasks).mockResolvedValue({
        operation: failedOperation,
        isComplete: true,
      })

      const promise = operation.execute('source.myshopify.com', 'target.myshopify.com', {})
      await expect(promise).rejects.toThrow(OperationError)
      await expect(promise).rejects.toMatchObject({
        operation: 'copy',
        code: ErrorCodes.COPY_FAILED,
      })
    })
  })
})

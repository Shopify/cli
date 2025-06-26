import Copy from './copy.js'
import {fetchOrgs} from '../../apis/destinations/index.js'
import {startBulkDataStoreCopy, pollBulkDataOperation} from '../../apis/organizations/index.js'
import {confirmCopyPrompt} from '../../prompts/confirm_copy.js'
import {parseResourceConfigFlags} from '../../lib/resource-config.js'
import {Shop, Organization} from '../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../apis/organizations/types.js'
import {
  TEST_MOCK_DATA,
  TEST_COPY_START_RESPONSE,
  TEST_COMPLETED_OPERATION,
  generateTestOperationResponse,
  generateTestOperationWithErrors,
  generateTestFailedStartResponse,
} from '../../services/store/mock/mock-data.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSuccess, renderTasks, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../../apis/destinations/index.js')
vi.mock('../../apis/organizations/index.js')
vi.mock('../../prompts/confirm_copy.js')
vi.mock('../../lib/resource-config.js')

const CommandConfig = new Config({root: __dirname})

describe('Copy', () => {
  const mockBpSession = 'mock-bp-session-token'
  const mockSourceShop: Shop = TEST_MOCK_DATA.sourceShop
  const mockTargetShop: Shop = TEST_MOCK_DATA.targetShop
  const mockOrganization: Organization = TEST_MOCK_DATA.organization
  const mockCopyStartResponse: BulkDataStoreCopyStartResponse = TEST_COPY_START_RESPONSE
  const mockCompletedOperation: BulkDataOperationByIdResponse = TEST_COMPLETED_OPERATION

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })
  })

  describe('run', () => {
    async function run(argv: string[]) {
      await CommandConfig.load()
      const copy = new Copy(argv, CommandConfig)
      await copy.run()
    }

    beforeEach(() => {
      vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue(mockBpSession)
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization])
      vi.mocked(confirmCopyPrompt).mockResolvedValue(true)
      vi.mocked(parseResourceConfigFlags).mockReturnValue({})
      vi.mocked(startBulkDataStoreCopy).mockResolvedValue(mockCopyStartResponse)
      vi.mocked(pollBulkDataOperation).mockResolvedValue(mockCompletedOperation)
      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx = {}
        // Process tasks sequentially
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

    test('should successfully copy data from source to target shop', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
      expect(fetchOrgs).toHaveBeenCalledWith(mockBpSession)
      expect(confirmCopyPrompt).toHaveBeenCalledWith('source.myshopify.com', 'target.myshopify.com')
      expect(outputInfo).toHaveBeenCalledWith('Copying from source.myshopify.com to target.myshopify.com')
      expect(startBulkDataStoreCopy).toHaveBeenCalledWith(
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
      vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue(mockBpSession)
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization])
      vi.mocked(parseResourceConfigFlags).mockReturnValue({})
      vi.mocked(outputInfo).mockImplementation(() => {})
      vi.mocked(startBulkDataStoreCopy).mockResolvedValue(mockCopyStartResponse)
      vi.mocked(pollBulkDataOperation).mockResolvedValue(mockCompletedOperation)
      vi.mocked(renderTasks).mockImplementation(async (tasks) => {
        const ctx = {}
        // Process tasks sequentially
        const processTask = async (index: number): Promise<void> => {
          if (index < tasks.length) {
            await tasks[index]!.task(ctx, tasks[index]!)
            await processTask(index + 1)
          }
        }
        await processTask(0)
        return ctx
      })
      vi.mocked(renderSuccess).mockReturnValue(undefined)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com', '--skipConfirmation'])

      expect(confirmCopyPrompt).not.toHaveBeenCalled()
      expect(renderError).not.toHaveBeenCalled()
      expect(startBulkDataStoreCopy).toHaveBeenCalledWith(
        'org1',
        'source.myshopify.com',
        'target.myshopify.com',
        {},
        mockBpSession,
      )
    })

    test('should exit when user cancels confirmation', async () => {
      vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue(mockBpSession)
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization])
      vi.mocked(confirmCopyPrompt).mockResolvedValue(false)
      vi.mocked(outputInfo).mockImplementation(() => {})

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(outputInfo).toHaveBeenCalledWith('Exiting.')
      expect(process.exit).toHaveBeenCalledWith(0)
      expect(startBulkDataStoreCopy).not.toHaveBeenCalled()
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Process exit called',
      })
    })

    test('should throw error when invalid flag combination', async () => {
      await run(['--fromStore=source.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should throw error when no flags provided', async () => {
      await run([])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should throw error when mixing store and file flags', async () => {
      await run(['--fromStore=source.myshopify.com', '--fromFile=input.sqlite', '--toStore=target.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should throw error export not implemented', async () => {
      await run(['--fromStore=source.myshopify.com', '--toFile=foo.sqlite'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error export not implemented when --toFile is <sqlite>', async () => {
      await run(['--fromStore=source.myshopify.com', '--toFile=<sqlite>'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error when source shop is not found', async () => {
      await run(['--fromStore=nonexistent.myshopify.com', '--toStore=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source shop (nonexistent.myshopify.com) not found.',
      })
    })

    test('should throw error when target shop is not found', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=nonexistent.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Target shop (nonexistent.myshopify.com) not found.',
      })
    })

    test('should throw error when source and target shops are the same', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=source.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source and target shops must not be the same.',
      })
    })

    test('should throw error when shops are in different organizations', async () => {
      const differentOrgShop: Shop = TEST_MOCK_DATA.differentOrgShop
      const differentOrg: Organization = TEST_MOCK_DATA.differentOrganization
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization, differentOrg])

      await run(['--fromStore=source.myshopify.com', '--toStore=different.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source and target shops must be in the same organization.',
      })
    })

    test('should filter out organizations with single shop', async () => {
      const singleShopOrg: Organization = TEST_MOCK_DATA.singleShopOrganization
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization, singleShopOrg])

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(startBulkDataStoreCopy).toHaveBeenCalled()
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

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com', '--key=products:handle'])

      expect(parseResourceConfigFlags).toHaveBeenCalledWith(['products:handle'])
      expect(startBulkDataStoreCopy).toHaveBeenCalledWith(
        'org1',
        'source.myshopify.com',
        'target.myshopify.com',
        mockResourceConfig,
        mockBpSession,
      )
    })

    test('should throw error when copy operation fails to start', async () => {
      const failedResponse: BulkDataStoreCopyStartResponse = generateTestFailedStartResponse()
      vi.mocked(startBulkDataStoreCopy).mockResolvedValue(failedResponse)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Failed to start copy operation: Invalid configuration, Insufficient permissions',
      })
    })

    test('should throw error when copy operation status is FAILED', async () => {
      const failedOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('FAILED')
      vi.mocked(pollBulkDataOperation).mockResolvedValue(failedOperation)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Copy operation failed',
      })
    })

    test('should render warning when copy completes with errors', async () => {
      const operationWithErrors: BulkDataOperationByIdResponse = generateTestOperationWithErrors()
      vi.mocked(pollBulkDataOperation).mockResolvedValue(operationWithErrors)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

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

      vi.mocked(pollBulkDataOperation)
        .mockResolvedValueOnce(inProgressOperation)
        .mockResolvedValueOnce(inProgressOperation)
        .mockResolvedValueOnce(mockCompletedOperation)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(pollBulkDataOperation).toHaveBeenCalledTimes(3)
      expect(pollBulkDataOperation).toHaveBeenCalledWith('org1', 'operation-123', mockBpSession)
      expect(renderSuccess).toHaveBeenCalled()
    })

    test('should throw error for export mode (not implemented)', async () => {
      await run(['--fromStore=source.myshopify.com', '--toFile=output.sqlite'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error for import mode (not implemented)', async () => {
      await run(['--fromFile=input.sqlite', '--toStore=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store import functionality is not implemented yet',
      })
    })

    test('should throw error when polling returns FAILED status', async () => {
      const inProgressOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('IN_PROGRESS')
      const failedOperation: BulkDataOperationByIdResponse = generateTestOperationResponse('FAILED')

      vi.mocked(pollBulkDataOperation).mockResolvedValueOnce(inProgressOperation).mockResolvedValueOnce(failedOperation)

      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Copy operation failed',
      })
    })
  })
})

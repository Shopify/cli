import Copy from './copy.js'
import {fetchOrgs} from '../../apis/destinations/index.js'
import {startBulkDataStoreCopy, pollBulkDataOperation} from '../../apis/organizations/index.js'
import {confirmCopyPrompt} from '../../prompts/confirm_copy.js'
import {parseResourceConfigFlags} from '../../lib/resource-config.js'
import {Shop, Organization} from '../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../apis/organizations/types.js'
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
  const mockSourceShop: Shop = {
    id: 'shop1',
    name: 'Source Shop',
    webUrl: 'https://source.myshopify.com',
    handle: 'source',
    publicId: 'gid://shopify/Shop/1',
    shortName: 'source',
    domain: 'source.myshopify.com',
    organizationId: 'org1',
  }
  const mockTargetShop: Shop = {
    id: 'shop2',
    name: 'Target Shop',
    webUrl: 'https://target.myshopify.com',
    handle: 'target',
    publicId: 'gid://shopify/Shop/2',
    shortName: 'target',
    domain: 'target.myshopify.com',
    organizationId: 'org1',
  }
  const mockOrganization: Organization = {
    id: 'org1',
    name: 'Test Organization',
    shops: [mockSourceShop, mockTargetShop],
  }

  const mockCopyStartResponse: BulkDataStoreCopyStartResponse = {
    bulkDataStoreCopyStart: {
      success: true,
      userErrors: [],
      operation: {
        id: 'operation-123',
        operationType: 'STORE_COPY',
        status: 'IN_PROGRESS',
      },
    },
  }

  const mockCompletedOperation: BulkDataOperationByIdResponse = {
    organization: {
      name: 'Test Organization',
      bulkData: {
        operation: {
          id: 'operation-123',
          operationType: 'STORE_COPY',
          status: 'COMPLETED',
          sourceStore: {
            id: 'shop1',
            name: 'Source Shop',
          },
          targetStore: {
            id: 'shop2',
            name: 'Target Shop',
          },
          storeOperations: [
            {
              id: 'store-op-1',
              store: {
                id: 'shop2',
                name: 'Target Shop',
              },
              remoteOperationType: 'COPY',
              remoteOperationStatus: 'COMPLETED',
              totalObjectCount: 100,
              completedObjectCount: 100,
              url: 'https://target.myshopify.com',
            },
          ],
        },
      },
    },
  }

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
      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

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

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com', '--skipConfirmation'])

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

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

      expect(outputInfo).toHaveBeenCalledWith('Exiting.')
      expect(process.exit).toHaveBeenCalledWith(0)
      expect(startBulkDataStoreCopy).not.toHaveBeenCalled()
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Process exit called',
      })
    })

    test('should throw error when to flag is missing', async () => {
      await run(['--from=target.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: expect.stringContaining('required flag to'),
      })
    })

    test('should throw error when from flag is missing', async () => {
      await run(['--to=target.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: expect.stringContaining('required flag from'),
      })
    })

    test('should throw error export not implemented', async () => {
      await run(['--from=source.myshopify.com', '--to=foo.sqlite'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error export not implemented when --to is <sqlite>', async () => {
      await run(['--from=source.myshopify.com', '--to=<sqlite>'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error when source shop is not found', async () => {
      await run(['--from=nonexistent.myshopify.com', '--to=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source shop (nonexistent.myshopify.com) not found.',
      })
    })

    test('should throw error when target shop is not found', async () => {
      await run(['--from=source.myshopify.com', '--to=nonexistent.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Target shop (nonexistent.myshopify.com) not found.',
      })
    })

    test('should throw error when source and target shops are the same', async () => {
      await run(['--from=source.myshopify.com', '--to=source.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source and target shops must not be the same.',
      })
    })

    test('should throw error when shops are in different organizations', async () => {
      const differentOrgShop: Shop = {
        id: 'shop3',
        name: 'Different Shop',
        webUrl: 'https://different.myshopify.com',
        handle: 'different',
        publicId: 'gid://shopify/Shop/3',
        shortName: 'different',
        domain: 'different.myshopify.com',
        organizationId: 'org2',
      }
      const differentOrg: Organization = {
        id: 'org2',
        name: 'Different Organization',
        // Include source shop to pass the filter
        shops: [mockSourceShop, differentOrgShop],
      }
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization, differentOrg])

      await run(['--from=source.myshopify.com', '--to=different.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Source and target shops must be in the same organization.',
      })
    })

    test('should filter out organizations with single shop', async () => {
      const singleShopOrg: Organization = {
        id: 'org3',
        name: 'Single Shop Org',
        shops: [
          {
            id: 'shop4',
            name: 'Single Shop',
            webUrl: 'https://single.myshopify.com',
            handle: 'single',
            publicId: 'gid://shopify/Shop/4',
            shortName: 'single',
            domain: 'single.myshopify.com',
            organizationId: 'org3',
          },
        ],
      }
      vi.mocked(fetchOrgs).mockResolvedValue([mockOrganization, singleShopOrg])

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

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

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com', '--key=products:handle'])

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
      const failedResponse: BulkDataStoreCopyStartResponse = {
        bulkDataStoreCopyStart: {
          success: false,
          userErrors: [
            {field: 'configuration', message: 'Invalid configuration'},
            {field: 'permissions', message: 'Insufficient permissions'},
          ],
          operation: {
            id: '',
            operationType: '',
            status: 'FAILED',
          },
        },
      }
      vi.mocked(startBulkDataStoreCopy).mockResolvedValue(failedResponse)

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Failed to start copy operation: Invalid configuration, Insufficient permissions',
      })
    })

    test('should throw error when copy operation status is FAILED', async () => {
      const failedOperation: BulkDataOperationByIdResponse = {
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: 'operation-123',
              operationType: 'STORE_COPY',
              status: 'FAILED',
              sourceStore: {
                id: 'shop1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'shop2',
                name: 'Target Shop',
              },
              storeOperations: [],
            },
          },
        },
      }
      vi.mocked(pollBulkDataOperation).mockResolvedValue(failedOperation)

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Copy operation failed',
      })
    })

    test('should render warning when copy completes with errors', async () => {
      const operationWithErrors: BulkDataOperationByIdResponse = {
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: 'operation-123',
              operationType: 'STORE_COPY',
              status: 'COMPLETED',
              sourceStore: {
                id: 'shop1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'shop2',
                name: 'Target Shop',
              },
              storeOperations: [
                {
                  id: 'store-op-1',
                  store: {
                    id: 'shop2',
                    name: 'Target Shop',
                  },
                  remoteOperationType: 'COPY',
                  remoteOperationStatus: 'COMPLETED',
                  totalObjectCount: 100,
                  completedObjectCount: 100,
                  url: 'https://target.myshopify.com',
                },
                {
                  id: 'store-op-2',
                  store: {
                    id: 'shop2',
                    name: 'Target Shop',
                  },
                  remoteOperationType: 'COPY',
                  remoteOperationStatus: 'FAILED',
                  totalObjectCount: 50,
                  completedObjectCount: 0,
                  url: 'https://target.myshopify.com',
                },
              ],
            },
          },
        },
      }
      vi.mocked(pollBulkDataOperation).mockResolvedValue(operationWithErrors)

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

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
      const inProgressOperation: BulkDataOperationByIdResponse = {
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: 'operation-123',
              operationType: 'STORE_COPY',
              status: 'IN_PROGRESS',
              sourceStore: {
                id: 'shop1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'shop2',
                name: 'Target Shop',
              },
              storeOperations: [],
            },
          },
        },
      }

      vi.mocked(pollBulkDataOperation)
        .mockResolvedValueOnce(inProgressOperation)
        .mockResolvedValueOnce(inProgressOperation)
        .mockResolvedValueOnce(mockCompletedOperation)

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

      expect(pollBulkDataOperation).toHaveBeenCalledTimes(3)
      expect(pollBulkDataOperation).toHaveBeenCalledWith('org1', 'operation-123', mockBpSession)
      expect(renderSuccess).toHaveBeenCalled()
    })

    test('should throw error for export mode (not implemented)', async () => {
      await run(['--from=source.myshopify.com', '--to=output.sqlite'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store export functionality is not implemented yet',
      })
    })

    test('should throw error for import mode (not implemented)', async () => {
      await run(['--from=input.sqlite', '--to=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Store import functionality is not implemented yet',
      })
    })

    test('should throw error when polling returns FAILED status', async () => {
      const inProgressOperation: BulkDataOperationByIdResponse = {
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: 'operation-123',
              operationType: 'STORE_COPY',
              status: 'IN_PROGRESS',
              sourceStore: {
                id: 'shop1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'shop2',
                name: 'Target Shop',
              },
              storeOperations: [],
            },
          },
        },
      }

      const failedOperation: BulkDataOperationByIdResponse = {
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: 'operation-123',
              operationType: 'STORE_COPY',
              status: 'FAILED',
              sourceStore: {
                id: 'shop1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'shop2',
                name: 'Target Shop',
              },
              storeOperations: [],
            },
          },
        },
      }

      vi.mocked(pollBulkDataOperation).mockResolvedValueOnce(inProgressOperation).mockResolvedValueOnce(failedOperation)

      await run(['--from=source.myshopify.com', '--to=target.myshopify.com'])

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Copy operation failed',
      })
    })
  })
})

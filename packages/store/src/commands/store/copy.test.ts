import Copy from './copy.js'
import {fetchOrgs} from '../../apis/destinations/index.js'
import {startBulkDataStoreCopy, pollBulkDataOperation} from '../../apis/organizations/index.js'
import {describe, expect, vi, test} from 'vitest'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import type {Organization} from '../../apis/destinations/types.js'
import type {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../apis/organizations/types.js'

vi.mock('../../apis/destinations/index.js', async () => {
  const actual = (await vi.importActual('../../apis/destinations/index.js')) as any
  return {
    ...actual,
    fetchOrgs: vi.fn(),
  }
})

vi.mock('../../apis/organizations/index.js', async () => {
  const actual = (await vi.importActual('../../apis/organizations/index.js')) as any
  return {
    ...actual,
    startBulkDataStoreCopy: vi.fn(),
    pollBulkDataOperation: vi.fn(),
  }
})

vi.mock('../../prompts/confirm_copy.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')

describe('Copy command', () => {
  const mockSession = 'test-session-token'
  const orgId = 'gid://Organization/123'
  const sourceShopDomain = 'source-shop.myshopify.com'
  const targetShopDomain = 'target-shop.myshopify.com'

  const createMockOrganization = (): Organization => ({
    id: orgId,
    name: 'Test Organization',
    shops: [
      {
        id: 'shop-1',
        name: 'Source Shop',
        domain: sourceShopDomain,
        organizationId: orgId,
        webUrl: `https://${sourceShopDomain}`,
        storeType: 'development',
        handle: 'source-shop',
        publicId: 'pub-1',
        shortName: 'source',
      },
      {
        id: 'shop-2',
        name: 'Target Shop',
        domain: targetShopDomain,
        organizationId: orgId,
        webUrl: `https://${targetShopDomain}`,
        storeType: 'development',
        handle: 'target-shop',
        publicId: 'pub-2',
        shortName: 'target',
      },
    ],
  })

  const createMockCopyResponse = (): BulkDataStoreCopyStartResponse => ({
    bulkDataStoreCopyStart: {
      success: true,
      operation: {
        id: 'operation-123',
        operationType: 'COPY',
        status: 'RUNNING',
      },
      userErrors: [],
    },
  })

  const createMockOperationResponse = (status: 'RUNNING' | 'COMPLETED'): BulkDataOperationByIdResponse => ({
    organization: {
      name: 'Test Organization',
      bulkData: {
        operation: {
          id: 'operation-123',
          operationType: 'STORE_COPY',
          status,
          sourceStore: {
            id: 'shop-1',
            name: 'Source Shop',
          },
          targetStore: {
            id: 'shop-2',
            name: 'Target Shop',
          },
          storeOperations: [
            {
              id: 'source-shop-export-operation',
              store: {
                id: 'shop-1',
                name: 'Source Shop',
              },
              remoteOperationType: 'export',
              remoteOperationStatus: 'COMPLETED',
              totalObjectCount: 100,
              completedObjectCount: 100,
              url: 'https://example.com/export-operation',
            },
            {
              id: 'target-shop-import-operation',
              store: {
                id: 'shop-2',
                name: 'Target Shop',
              },
              remoteOperationType: 'import',
              remoteOperationStatus: status,
              totalObjectCount: 100,
              completedObjectCount: status === 'COMPLETED' ? 100 : 48,
              url: 'https://example.com/import-operation',
            },
          ],
        },
      },
    },
  })

  const setupMocks = () => {
    const mockOrg = createMockOrganization()
    const mockCopyResponse = createMockCopyResponse()
    const mockRunningOperation = createMockOperationResponse('RUNNING')

    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue(mockSession)
    vi.mocked(fetchOrgs).mockResolvedValue([mockOrg])
    vi.mocked(startBulkDataStoreCopy).mockResolvedValue(mockCopyResponse)
    vi.mocked(pollBulkDataOperation).mockResolvedValue(mockRunningOperation)

    return {mockOrg, mockCopyResponse, mockRunningOperation}
  }

  const runCopyCommand = async (flags: any) => {
    const {mockOrg} = setupMocks()

    const mockRunningOperation = createMockOperationResponse('RUNNING')
    const mockCompletedOperation = createMockOperationResponse('COMPLETED')

    vi.mocked(pollBulkDataOperation)
      .mockResolvedValueOnce(mockRunningOperation)
      .mockResolvedValueOnce(mockRunningOperation)
      .mockResolvedValueOnce(mockRunningOperation)
      .mockResolvedValueOnce(mockRunningOperation)
      .mockResolvedValueOnce(mockCompletedOperation)

    const copy = new Copy([], {} as any)
    copy.flags = flags

    vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback()
      return {} as any
    })

    const sourceShop = mockOrg.shops.find((shop) => shop.domain === sourceShopDomain)!
    const targetShop = mockOrg.shops.find((shop) => shop.domain === targetShopDomain)!

    // eslint-disable-next-line dot-notation
    return copy['executeCopyOperation'](orgId, sourceShop, targetShop, mockSession)
  }

  describe('when copying between shops in the same organization', () => {
    test('calls startBulkDataStoreCopy with the correct arguments', async () => {
      await runCopyCommand({
        from: sourceShopDomain,
        to: targetShopDomain,
      })

      expect(startBulkDataStoreCopy).toHaveBeenCalledWith(orgId, sourceShopDomain, targetShopDomain, {}, mockSession)
    })

    test('polls the operation until it is completed', async () => {
      const result = await runCopyCommand({
        from: sourceShopDomain,
        to: targetShopDomain,
      })

      expect(pollBulkDataOperation).toHaveBeenCalledTimes(5)
      expect(result.organization.bulkData.operation.status).toBe('COMPLETED')
    })

    // eslint-disable-next-line vitest/max-nested-describe
    describe('when there are resource configs specified', () => {
      test('transforms field resource config into correct format', async () => {
        await runCopyCommand({
          from: sourceShopDomain,
          to: targetShopDomain,
          key: ['products:handle'],
        })

        expect(startBulkDataStoreCopy).toHaveBeenCalledWith(
          orgId,
          sourceShopDomain,
          targetShopDomain,
          {products: {identifier: {field: 'HANDLE', customId: undefined}}},
          mockSession,
        )
      })

      test('transforms unique metafield resource config into correct format', async () => {
        await runCopyCommand({
          from: sourceShopDomain,
          to: targetShopDomain,
          key: ['products:metafield:custom:salesforce_id'],
        })

        expect(startBulkDataStoreCopy).toHaveBeenCalledWith(
          orgId,
          sourceShopDomain,
          targetShopDomain,
          {products: {identifier: {field: undefined, customId: {namespace: 'custom', key: 'salesforce_id'}}}},
          mockSession,
        )
      })
    })
  })
})

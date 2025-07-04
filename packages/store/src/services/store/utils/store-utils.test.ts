import {findStore, ensureOrgHasBulkDataAccess} from './store-utils.js'
import {Organization} from '../../../apis/destinations/index.js'
import {MockApiClient} from '../mock/mock-api-client.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'

describe('store-utils', () => {
  describe('findStore', () => {
    const mockOrganizations: Organization[] = [
      {
        id: 'gid://organization/1',
        name: 'Test Organization 1',
        shops: [
          {
            id: 'gid://shop/1',
            domain: 'shop1.myshopify.com',
            organizationId: 'gid://organization/1',
            name: 'Shop 1',
            status: 'active',
            publicId: 'shop1',
            webUrl: 'https://shop1.myshopify.com',
          },
          {
            id: 'gid://shop/2',
            domain: 'shop2.myshopify.com',
            organizationId: 'gid://organization/1',
            name: 'Shop 2',
            status: 'active',
            publicId: 'shop2',
            webUrl: 'https://shop2.myshopify.com',
          },
        ],
      },
      {
        id: 'gid://organization/2',
        name: 'Test Organization 2',
        shops: [
          {
            id: 'gid://shop/3',
            domain: 'shop3.myshopify.com',
            organizationId: 'gid://organization/2',
            name: 'Shop 3',
            status: 'active',
            publicId: 'shop3',
            webUrl: 'https://shop3.myshopify.com',
          },
          {
            id: 'gid://shop/4',
            domain: 'shop4.myshopify.com',
            organizationId: 'gid://organization/2',
            name: 'Shop 4',
            status: 'active',
            publicId: 'shop4',
            webUrl: 'https://shop4.myshopify.com',
          },
        ],
      },
    ]

    test('should find shop by domain when it exists', () => {
      const result = findStore('shop2.myshopify.com', mockOrganizations)
      expect(result).toEqual({
        id: 'gid://shop/2',
        domain: 'shop2.myshopify.com',
        organizationId: 'gid://organization/1',
        name: 'Shop 2',
        status: 'active',
        publicId: 'shop2',
        webUrl: 'https://shop2.myshopify.com',
      })
    })

    test('should find shop from second organization', () => {
      const result = findStore('shop3.myshopify.com', mockOrganizations)
      expect(result).toEqual({
        id: 'gid://shop/3',
        domain: 'shop3.myshopify.com',
        organizationId: 'gid://organization/2',
        name: 'Shop 3',
        status: 'active',
        publicId: 'shop3',
        webUrl: 'https://shop3.myshopify.com',
      })
    })

    test('should find shop by prefix', () => {
      const result = findStore('shop3', mockOrganizations)
      expect(result).toEqual({
        id: 'gid://shop/3',
        domain: 'shop3.myshopify.com',
        organizationId: 'gid://organization/2',
        name: 'Shop 3',
        status: 'active',
        publicId: 'shop3',
        webUrl: 'https://shop3.myshopify.com',
      })
    })

    test('should return undefined when shop does not exist', () => {
      const result = findStore('nonexistent.myshopify.com', mockOrganizations)
      expect(result).toBeUndefined()
    })

    test('should return undefined when organizations array is empty', () => {
      const result = findStore('shop1.myshopify.com', [])
      expect(result).toBeUndefined()
    })

    test('should return undefined when organization has no shops', () => {
      const orgsWithNoShops: Organization[] = [
        {
          id: 'gid://organization/1',
          name: 'Test Organization',
          shops: [],
        },
      ]
      const result = findStore('shop1.myshopify.com', orgsWithNoShops)
      expect(result).toBeUndefined()
    })
  })

  describe('ensureOrgHasBulkDataAccess', () => {
    const mockOrganizationId = 'gid://organization/1'
    const mockToken = 'test-token'
    let mockApiClient: MockApiClient

    beforeEach(() => {
      mockApiClient = new MockApiClient()
    })

    test('should return true when user has access (Invalid BulkDataOperationID error)', async () => {
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockRejectedValue(new Error('Invalid BulkDataOperationID'))

      const result = await ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)
      expect(result).toBe(true)
    })

    test('should return true when user has access (BulkDataOperation not found error)', async () => {
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockRejectedValue(new Error('BulkDataOperation not found'))

      const result = await ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)
      expect(result).toBe(true)
    })

    test('should return false when bulk data field does not exist', async () => {
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockRejectedValue(
        new Error("Field 'bulkData' doesn't exist on type 'Organization'"),
      )

      const result = await ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)
      expect(result).toBe(false)
    })

    test('should throw error for unexpected errors', async () => {
      const unexpectedError = new Error('Network error')
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockRejectedValue(unexpectedError)

      await expect(ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)).rejects.toThrow(
        'Network error',
      )
    })

    test('should rethrow non-Error objects', async () => {
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockRejectedValue('string error')

      await expect(ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)).rejects.toBe(
        'string error',
      )
    })

    test('should call pollBulkDataOperation with correct parameters', async () => {
      const pollSpy = vi
        .spyOn(mockApiClient, 'pollBulkDataOperation')
        .mockRejectedValue(new Error('Invalid BulkDataOperationID'))

      await ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)

      expect(pollSpy).toHaveBeenCalledWith(mockOrganizationId, '99999999999999999999999999999999', mockToken)
    })

    test('should return true when successful response is received', async () => {
      vi.spyOn(mockApiClient, 'pollBulkDataOperation').mockResolvedValue({
        organization: {
          name: 'Test Organization',
          bulkData: {
            operation: {
              id: '99999999999999999999999999999999',
              operationType: 'COPY',
              status: 'COMPLETED',
              sourceStore: {
                id: 'gid://shop/1',
                name: 'Source Shop',
              },
              targetStore: {
                id: 'gid://shop/2',
                name: 'Target Shop',
              },
              storeOperations: [],
            },
          },
        },
      })

      const result = await ensureOrgHasBulkDataAccess(mockOrganizationId, mockToken, mockApiClient)
      expect(result).toBe(true)
    })
  })
})

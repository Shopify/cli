import {runBulkOperationQuery} from './run-query.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {describe, test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')

describe('runBulkOperationQuery', () => {
  const mockSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
  const successfulBulkOperation = {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    objectCount: '0',
    fileSize: '0',
    url: null,
  }
  const mockSuccessResponse = {
    bulkOperationRunQuery: {
      bulkOperation: successfulBulkOperation,
      userErrors: [],
    },
  }

  test('returns a bulk operation when request succeeds', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const bulkOperationResult = await runBulkOperationQuery({
      adminSession: mockSession,
      query: 'query { products { edges { node { id } } } }',
    })

    expect(bulkOperationResult?.bulkOperation).toEqual(successfulBulkOperation)
    expect(bulkOperationResult?.userErrors).toEqual([])
  })

  test('starts bulk query with specific API version when provided', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    await runBulkOperationQuery({
      adminSession: mockSession,
      query: 'query { products { edges { node { id } } } }',
      version: '2025-01',
    })

    expect(adminRequestDoc).toHaveBeenCalledWith(expect.objectContaining({version: '2025-01'}))
  })
})

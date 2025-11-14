import {runBulkOperationQuery} from './run-query.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AbortError} from '@shopify/cli-kit/node/error'
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

  test('throws AbortError when variables are provided with a query', async () => {
    const query = '{ products { edges { node { id } } } }'
    const variables = '[{"input":{"id":"gid://shopify/Product/123"}}]'

    await expect(
      runBulkOperationQuery({
        adminSession: mockSession,
        query,
        variables,
      }),
    ).rejects.toThrow(AbortError)

    expect(adminRequestDoc).not.toHaveBeenCalled()
  })
})

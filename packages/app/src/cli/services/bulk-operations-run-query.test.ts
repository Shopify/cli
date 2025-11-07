import {runBulkOperationQuery} from './bulk-operation-run-query.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/session')

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

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockSession)
  })

  test('returns a bulk operation when request succeeds', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSuccessResponse)

    const bulkOperationResult = await runBulkOperationQuery({
      storeFqdn: 'test-store.myshopify.com',
      query: 'query { products { edges { node { id } } } }',
    })

    expect(bulkOperationResult.result).toEqual(successfulBulkOperation)
    expect(bulkOperationResult.errors).toBeUndefined()
  })
})

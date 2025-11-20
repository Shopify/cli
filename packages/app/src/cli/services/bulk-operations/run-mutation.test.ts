import {runBulkOperationMutation} from './run-mutation.js'
import {stageFile} from './stage-file.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('./stage-file.js')

describe('runBulkOperationMutation', () => {
  const mockSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
  const successfulBulkOperation = {
    id: 'gid://shopify/BulkOperation/456',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    objectCount: '0',
    fileSize: '0',
    url: null,
  }
  const mockSuccessResponse = {
    bulkOperationRunMutation: {
      bulkOperation: successfulBulkOperation,
      userErrors: [],
    },
  }

  beforeEach(() => {
    vi.mocked(stageFile).mockResolvedValue('staged-uploads/bulk-mutation.jsonl')
  })

  test('returns a bulk operation when request succeeds', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const bulkOperationResult = await runBulkOperationMutation({
      adminSession: mockSession,
      query: 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }',
      variablesJsonl: '{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}',
    })

    expect(bulkOperationResult?.bulkOperation).toEqual(successfulBulkOperation)
    expect(bulkOperationResult?.userErrors).toEqual([])
  })
})

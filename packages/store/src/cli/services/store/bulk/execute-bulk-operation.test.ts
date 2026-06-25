import {executeBulkOperation} from './execute-bulk-operation.js'
import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {
  runBulkOperationQuery,
  runBulkOperationMutation,
  shortBulkOperationPoll,
  watchBulkOperation,
  downloadBulkOperationResults,
  resolveApiVersion,
  BULK_OPERATIONS_MIN_API_VERSION,
  type BulkOperation,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./bulk-admin-context.js')
vi.mock('@shopify/cli-kit/node/api/bulk-operations', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/api/bulk-operations')
  return {
    ...actual,
    runBulkOperationQuery: vi.fn(),
    runBulkOperationMutation: vi.fn(),
    watchBulkOperation: vi.fn(),
    shortBulkOperationPoll: vi.fn(),
    downloadBulkOperationResults: vi.fn(),
    resolveApiVersion: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/ui')
  return {
    ...actual,
    renderSingleTask: vi.fn(async ({task}) => task()),
    renderSuccess: vi.fn(),
    renderWarning: vi.fn(),
    renderError: vi.fn(),
    renderInfo: vi.fn(),
  }
})

const store = 'shop.myshopify.com'
const adminSession = {token: 'token', storeFqdn: store}
const createdOperation: BulkOperation = {
  id: 'gid://shopify/BulkOperation/123',
  type: 'QUERY',
  status: 'CREATED',
  errorCode: null,
  createdAt: '2024-01-01T00:00:00Z',
  completedAt: null,
  objectCount: '0',
  url: null,
  partialDataUrl: null,
}

beforeEach(() => {
  vi.mocked(prepareBulkAdminContext).mockResolvedValue(adminSession)
  vi.mocked(resolveApiVersion).mockResolvedValue(BULK_OPERATIONS_MIN_API_VERSION)
  vi.mocked(shortBulkOperationPoll).mockResolvedValue(createdOperation)
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('executeBulkOperation', () => {
  test('runs a query operation', async () => {
    vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: createdOperation, userErrors: []})

    await executeBulkOperation({store, query: 'query { products { edges { node { id } } } }'})

    expect(prepareBulkAdminContext).toHaveBeenCalledWith(store)
    expect(runBulkOperationQuery).toHaveBeenCalledWith({
      adminSession,
      query: 'query { products { edges { node { id } } } }',
      version: BULK_OPERATIONS_MIN_API_VERSION,
    })
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('blocks mutations unless --allow-mutations is set', async () => {
    await expect(
      executeBulkOperation({store, query: 'mutation { productUpdate(input: {}) { product { id } } }'}),
    ).rejects.toThrow(AbortError)

    expect(prepareBulkAdminContext).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('runs a mutation when allowMutations is true', async () => {
    vi.mocked(runBulkOperationMutation).mockResolvedValue({bulkOperation: createdOperation, userErrors: []})
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'

    await executeBulkOperation({
      store,
      query: mutation,
      variables: ['{"input":{"id":"gid://shopify/Product/1"}}'],
      allowMutations: true,
    })

    expect(runBulkOperationMutation).toHaveBeenCalledWith({
      adminSession,
      query: mutation,
      variablesJsonl: '{"input":{"id":"gid://shopify/Product/1"}}',
      version: BULK_OPERATIONS_MIN_API_VERSION,
    })
  })

  test('points users at the store bulk status command', async () => {
    vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: createdOperation, userErrors: []})

    await executeBulkOperation({store, query: '{ products { edges { node { id } } } }'})

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        body: ['Monitor its progress with:\n', {command: 'shopify store bulk status --id=123'}],
      }),
    )
  })

  describe('--watch result rendering', () => {
    const completedOperation: BulkOperation = {
      ...createdOperation,
      status: 'COMPLETED',
      objectCount: '2',
      completedAt: '2024-01-01T00:05:00Z',
      url: 'https://example.com/results.jsonl',
    }

    beforeEach(() => {
      vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: createdOperation, userErrors: []})
    })

    test('downloads results and renders success for a completed operation', async () => {
      vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
      vi.mocked(downloadBulkOperationResults).mockResolvedValue('{"data":{"products":{"edges":[]}}}')
      const output = mockAndCaptureOutput()

      await executeBulkOperation({store, query: '{ products { edges { node { id } } } }', watch: true})

      expect(downloadBulkOperationResults).toHaveBeenCalledWith('https://example.com/results.jsonl')
      expect(renderSuccess).toHaveBeenCalledWith(
        expect.objectContaining({headline: expect.stringContaining('Bulk operation succeeded')}),
      )
      expect(output.output()).toContain('products')
    })

    test('does not crash on an empty result file', async () => {
      vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
      vi.mocked(downloadBulkOperationResults).mockResolvedValue('')

      await expect(
        executeBulkOperation({store, query: '{ products { edges { node { id } } } }', watch: true}),
      ).resolves.not.toThrow()

      expect(renderSuccess).toHaveBeenCalledWith(
        expect.objectContaining({headline: expect.stringContaining('Bulk operation succeeded')}),
      )
    })

    test('renders a warning when the results contain user errors', async () => {
      vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
      vi.mocked(downloadBulkOperationResults).mockResolvedValue(
        '{"data":{"productUpdate":{"product":null,"userErrors":[{"message":"Invalid"}]}}}',
      )

      await executeBulkOperation({store, query: '{ products { edges { node { id } } } }', watch: true})

      expect(renderWarning).toHaveBeenCalledWith(
        expect.objectContaining({headline: 'Bulk operation completed with errors.'}),
      )
    })

    test('renders an error for a failed operation', async () => {
      vi.mocked(watchBulkOperation).mockResolvedValue({
        ...createdOperation,
        status: 'FAILED',
        errorCode: 'INTERNAL_SERVER_ERROR',
        completedAt: '2024-01-01T00:05:00Z',
      })

      await executeBulkOperation({store, query: '{ products { edges { node { id } } } }', watch: true})

      expect(downloadBulkOperationResults).not.toHaveBeenCalled()
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({headline: expect.stringContaining('Bulk operation failed')}),
      )
    })
  })
})

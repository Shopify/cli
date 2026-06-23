import {executeBulkOperation} from './execute-bulk-operation.js'
import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {
  runBulkOperationQuery,
  runBulkOperationMutation,
  shortBulkOperationPoll,
  resolveApiVersion,
  BULK_OPERATIONS_MIN_API_VERSION,
  type BulkOperation,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
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
  vi.mocked(prepareBulkAdminContext).mockResolvedValue({adminSession, session: {} as never})
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
})

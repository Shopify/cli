import {cancelBulkOperation} from './cancel-bulk-operation.js'
import {renderCancelBulkOperationResult} from './cancel-result.js'
import {BULK_OPERATIONS_MIN_API_VERSION, cancelBulkOperationRequest} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/bulk-operations', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/api/bulk-operations')
  return {
    ...actual,
    cancelBulkOperationRequest: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/ui')

const store = 'shop.myshopify.com'
const operationId = 'gid://shopify/BulkOperation/123'
const adminSession = {token: 'token', storeFqdn: store}

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('cancelBulkOperation', () => {
  test('returns the requested version and store even when no operation is found', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue(null)

    const result = await cancelBulkOperation({adminSession, operationId, version: '2026-07'})

    expect(result).toEqual({store, apiVersion: '2026-07', operation: null, userErrors: []})
    expect(cancelBulkOperationRequest).toHaveBeenCalledExactlyOnceWith({adminSession, operationId, version: '2026-07'})
  })

  test('renders success when the operation is canceling', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: {
        id: operationId,
        type: 'QUERY',
        status: 'CANCELING',
        objectCount: '0',
        query: '{ products { edges { node { id } } } }',
        rootObjectCount: '0',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: null,
      },
      userErrors: [],
    })

    const result = await cancelBulkOperation({adminSession, operationId})
    expect(result).toMatchObject({store, apiVersion: BULK_OPERATIONS_MIN_API_VERSION})
    expect(cancelBulkOperationRequest).toHaveBeenCalledOnce()
    renderCancelBulkOperationResult(result, operationId, 'text')

    expect(cancelBulkOperationRequest).toHaveBeenCalledWith({adminSession, operationId})
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation is being cancelled.',
        body: [
          'This may take a few moments. Check the status with:\n',
          {command: 'shopify store bulk status --id=123'},
        ],
      }),
    )
  })

  test('renders user errors when present', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: null,
      userErrors: [{field: ['id'], message: 'Operation not found'}],
    })

    const result = await cancelBulkOperation({adminSession, operationId})
    renderCancelBulkOperationResult(result, operationId, 'text')

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Failed to cancel bulk operation.',
      body: 'id: Operation not found',
    })
  })

  test('renders a warning for an already-finished operation', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: {
        id: operationId,
        type: 'QUERY',
        status: 'COMPLETED',
        objectCount: '10',
        rootObjectCount: '10',
        query: '{ products { edges { node { id } } } }',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T01:00:00Z',
      },
      userErrors: [],
    })

    const result = await cancelBulkOperation({adminSession, operationId})
    renderCancelBulkOperationResult(result, operationId, 'text')

    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('already completed')}),
    )
  })
})

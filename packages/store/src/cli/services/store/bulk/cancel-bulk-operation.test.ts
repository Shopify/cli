import {cancelBulkOperation} from './cancel-bulk-operation.js'
import {prepareBulkAdminContext} from './bulk-admin-context.js'
import {cancelBulkOperationRequest} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./bulk-admin-context.js')
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

beforeEach(() => {
  vi.mocked(prepareBulkAdminContext).mockResolvedValue({adminSession, session: {} as never})
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('cancelBulkOperation', () => {
  test('renders success when the operation is canceling', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: {id: operationId, status: 'CANCELING', createdAt: '2024-01-01T00:00:00Z', completedAt: null},
      userErrors: [],
    } as never)

    await cancelBulkOperation({store, operationId})

    expect(prepareBulkAdminContext).toHaveBeenCalledWith(store)
    expect(cancelBulkOperationRequest).toHaveBeenCalledWith({adminSession, operationId})
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({headline: 'Bulk operation is being cancelled.'}),
    )
  })

  test('renders user errors when present', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: null,
      userErrors: [{field: ['id'], message: 'Operation not found'}],
    } as never)

    await cancelBulkOperation({store, operationId})

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Failed to cancel bulk operation.',
      body: 'id: Operation not found',
    })
  })

  test('renders a warning for an already-finished operation', async () => {
    vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
      bulkOperation: {
        id: operationId,
        status: 'COMPLETED',
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T01:00:00Z',
      },
      userErrors: [],
    } as never)

    await cancelBulkOperation({store, operationId})

    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('already completed')}),
    )
  })
})

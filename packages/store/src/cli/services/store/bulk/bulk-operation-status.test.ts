import {getBulkOperationStatus, listBulkOperations} from './bulk-operation-status.js'
import {renderBulkOperationStatusResult} from './status-result.js'
import {
  fetchBulkOperationById,
  fetchRecentBulkOperations,
  resolveApiVersion,
  BULK_OPERATIONS_MIN_API_VERSION,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/bulk-operations', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/api/bulk-operations')
  return {
    ...actual,
    fetchBulkOperationById: vi.fn(),
    fetchRecentBulkOperations: vi.fn(),
    resolveApiVersion: vi.fn(),
  }
})

const store = 'shop.myshopify.com'
const operationId = 'gid://shopify/BulkOperation/123'
const adminSession = {token: 'token', storeFqdn: store}

beforeEach(() => {
  vi.mocked(resolveApiVersion).mockResolvedValue(BULK_OPERATIONS_MIN_API_VERSION)
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('getBulkOperationStatus', () => {
  test('renders the operation status for a completed operation', async () => {
    vi.mocked(fetchBulkOperationById).mockResolvedValue({
      id: operationId,
      type: 'QUERY',
      status: 'COMPLETED',
      errorCode: null,
      objectCount: 100,
      createdAt: new Date(Date.now() - 120000).toISOString(),
      completedAt: new Date(Date.now() - 60000).toISOString(),
      url: 'https://example.com/results.jsonl',
      partialDataUrl: null,
    })

    const output = mockAndCaptureOutput()
    const result = await getBulkOperationStatus({adminSession, operationId})
    expect(result).toMatchObject({store, apiVersion: BULK_OPERATIONS_MIN_API_VERSION})
    expect(fetchBulkOperationById).toHaveBeenCalledOnce()
    expect(resolveApiVersion).toHaveBeenCalledOnce()
    renderBulkOperationStatusResult(result, 'text')

    expect(fetchBulkOperationById).toHaveBeenCalledWith({
      adminSession,
      operationId,
      version: BULK_OPERATIONS_MIN_API_VERSION,
    })
    expect(output.output()).toContain('Bulk operation succeeded:')
    expect(output.output()).toContain('Download results')
  })

  test('renders an error when the operation is not found', async () => {
    vi.mocked(fetchBulkOperationById).mockResolvedValue(null)

    const output = mockAndCaptureOutput()
    const result = await getBulkOperationStatus({adminSession, operationId})
    expect(result).toEqual({store, apiVersion: BULK_OPERATIONS_MIN_API_VERSION, operationId, operation: null})
    renderBulkOperationStatusResult(result, 'text')

    expect(output.error()).toContain('Bulk operation not found.')
  })
})

describe('listBulkOperations', () => {
  test('renders a table of recent operations', async () => {
    vi.mocked(fetchRecentBulkOperations).mockResolvedValue([
      {
        id: 'gid://shopify/BulkOperation/1',
        status: 'COMPLETED',
        errorCode: null,
        objectCount: 123500,
        createdAt: '2025-11-10T12:37:52Z',
        completedAt: '2025-11-10T16:37:12Z',
        url: 'https://example.com/results.jsonl',
        partialDataUrl: null,
      },
    ])

    const output = mockAndCaptureOutput()
    const result = await listBulkOperations({adminSession})
    expect(result).toMatchObject({store, apiVersion: BULK_OPERATIONS_MIN_API_VERSION})
    expect(fetchRecentBulkOperations).toHaveBeenCalledOnce()
    expect(resolveApiVersion).toHaveBeenCalledOnce()
    renderBulkOperationStatusResult(result, 'text')

    // The count is formatted as 123.5K (it may wrap across lines in the rendered table).
    expect(output.output()).toContain('123.5')
    expect(output.output()).toContain('download')
  })

  test('renders an empty state when there are no operations', async () => {
    vi.mocked(fetchRecentBulkOperations).mockResolvedValue([])

    const output = mockAndCaptureOutput()
    const result = await listBulkOperations({adminSession})
    expect(result).toEqual({store, apiVersion: BULK_OPERATIONS_MIN_API_VERSION, operations: []})
    renderBulkOperationStatusResult(result, 'text')

    expect(output.info()).toContain('No bulk operations found in the last 7 days.')
  })
})

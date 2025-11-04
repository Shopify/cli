import {runBulkQuery} from './bulk-operations.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {sleep} from '@shopify/cli-kit/node/system'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/admin')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/output')

describe('runBulkQuery', () => {
  const mockSession: AdminSession = {
    token: 'test-token',
    storeFqdn: 'test.myshopify.com',
  }

  const mockQuery = 'query { products { id } }'

  beforeEach(() => {})

  test('successfully completes bulk query and returns results', async () => {
    vi.useFakeTimers()

    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(sleep).mockImplementation(async () => {
      vi.advanceTimersByTime(1000)
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'RUNNING',
        objectCount: '50',
        errorCode: null,
        url: null,
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '100',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}\n{"id":"2"}',
    })

    const result = await runBulkQuery(mockQuery, mockSession)

    expect(result.content).toBe('{"id":"1"}\n{"id":"2"}')
    expect(result.totalObjects).toBe(100)
    expect(result.totalTimeSeconds).toBeGreaterThan(0)
    expect(result.averageRate).toBeGreaterThan(0)
    expect(vi.mocked(outputInfo)).toHaveBeenCalledWith('bulk operation started: gid://shopify/BulkOperation/123')

    vi.useRealTimers()
  })

  test('throws error when bulk operation has user errors', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [
          {field: 'query', message: 'Invalid query'},
          {field: 'variables', message: 'Missing required variable'},
        ],
      },
    })

    await expect(runBulkQuery(mockQuery, mockSession)).rejects.toThrow(
      'bulk operation failed: Invalid query, Missing required variable',
    )
  })

  test('throws error when bulk operation fails', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'FAILED',
        objectCount: '0',
        errorCode: 'TIMEOUT',
        url: null,
      },
    })

    await expect(runBulkQuery(mockQuery, mockSession)).rejects.toThrow('bulk operation failed: TIMEOUT')
  })

  test('throws error when completed operation has no url', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '100',
        errorCode: null,
        url: null,
      },
    })

    await expect(runBulkQuery(mockQuery, mockSession)).rejects.toThrow('bulk operation completed but no results url')
  })

  test('calls progress callback with correct values', async () => {
    const progressCallback = vi.fn()

    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'RUNNING',
        objectCount: '50',
        errorCode: null,
        url: null,
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '100',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    await runBulkQuery(mockQuery, mockSession, progressCallback)

    expect(progressCallback).toHaveBeenCalled()
    expect(progressCallback).toHaveBeenCalledWith('RUNNING', '50', expect.any(Number), expect.any(String))
  })

  test('calculates rate correctly when object count increases', async () => {
    vi.useFakeTimers()

    const progressCallback = vi.fn()
    let callCount = 0

    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(sleep).mockImplementation(async () => {
      vi.advanceTimersByTime(1000)
    })

    vi.mocked(adminRequest).mockImplementation(async () => {
      callCount++
      if (callCount === 1) {
        return {
          currentBulkOperation: {
            id: 'gid://shopify/BulkOperation/123',
            status: 'RUNNING',
            objectCount: '100',
            errorCode: null,
            url: null,
          },
        }
      } else if (callCount === 2) {
        return {
          currentBulkOperation: {
            id: 'gid://shopify/BulkOperation/123',
            status: 'RUNNING',
            objectCount: '200',
            errorCode: null,
            url: null,
          },
        }
      } else {
        return {
          currentBulkOperation: {
            id: 'gid://shopify/BulkOperation/123',
            status: 'COMPLETED',
            objectCount: '200',
            errorCode: null,
            url: 'https://example.com/results.jsonl',
          },
        }
      }
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    await runBulkQuery(mockQuery, mockSession, progressCallback)

    const callsWithRate = progressCallback.mock.calls.filter((call) => call[2] > 0)
    expect(callsWithRate.length).toBeGreaterThan(0)

    vi.useRealTimers()
  })

  test('handles CREATED status', async () => {
    const progressCallback = vi.fn()

    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'CREATED',
        objectCount: '0',
        errorCode: null,
        url: null,
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '50',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    await runBulkQuery(mockQuery, mockSession, progressCallback)

    expect(progressCallback).toHaveBeenCalledWith('CREATED', '0', expect.any(Number), expect.any(String))
  })

  test('spinner cycles through frames', async () => {
    const progressCallback = vi.fn()

    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest)
      .mockResolvedValueOnce({
        currentBulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'RUNNING',
          objectCount: '0',
          errorCode: null,
          url: null,
        },
      })
      .mockResolvedValueOnce({
        currentBulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'RUNNING',
          objectCount: '0',
          errorCode: null,
          url: null,
        },
      })
      .mockResolvedValueOnce({
        currentBulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'RUNNING',
          objectCount: '0',
          errorCode: null,
          url: null,
        },
      })
      .mockResolvedValueOnce({
        currentBulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'COMPLETED',
          objectCount: '0',
          errorCode: null,
          url: 'https://example.com/results.jsonl',
        },
      })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '',
    })

    await runBulkQuery(mockQuery, mockSession, progressCallback)

    const spinnerValues = progressCallback.mock.calls.map((call) => call[3])
    expect(spinnerValues).toContain('.')
    expect(spinnerValues).toContain('..')
    expect(spinnerValues).toContain('...')
  })

  test('sleeps between polls', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '100',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    await runBulkQuery(mockQuery, mockSession)

    expect(vi.mocked(sleep)).toHaveBeenCalledWith(1)
  })

  test('passes correct mutation to start bulk operation', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '100',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    await runBulkQuery(mockQuery, mockSession)

    expect(vi.mocked(adminRequest)).toHaveBeenCalledWith(
      expect.stringContaining('bulkOperationRunQuery'),
      mockSession,
      {query: mockQuery},
    )
  })

  test('calculates average rate correctly', async () => {
    vi.mocked(adminRequest).mockResolvedValueOnce({
      bulkOperationRunQuery: {
        bulkOperation: {
          id: 'gid://shopify/BulkOperation/123',
          status: 'CREATED',
        },
        userErrors: [],
      },
    })

    vi.mocked(adminRequest).mockResolvedValueOnce({
      currentBulkOperation: {
        id: 'gid://shopify/BulkOperation/123',
        status: 'COMPLETED',
        objectCount: '1000',
        errorCode: null,
        url: 'https://example.com/results.jsonl',
      },
    })

    // @ts-expect-error - partial mock
    vi.mocked(fetch).mockResolvedValueOnce({
      text: async () => '{"id":"1"}',
    })

    const result = await runBulkQuery(mockQuery, mockSession)

    expect(result.averageRate).toBe(1000 / result.totalTimeSeconds)
    expect(result.averageRate).toBeGreaterThan(0)
  })
})

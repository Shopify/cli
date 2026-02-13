import {
  watchBulkOperation,
  shortBulkOperationPoll,
  QUICK_WATCH_POLL_INTERVAL_MS,
  QUICK_WATCH_TIMEOUT_MS,
} from './watch-bulk-operation.js'
import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {adminRequestDoc} from '@shopify/cli-kit/admin/api'
import {sleep} from '@shopify/cli-kit/shared/node/system'
import {renderSingleTask} from '@shopify/cli-kit/shared/node/ui'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {outputContent} from '@shopify/cli-kit/shared/node/output'
import {AbortController} from '@shopify/cli-kit/shared/node/abort'

vi.mock('./format-bulk-operation-status.js')
vi.mock('@shopify/cli-kit/admin/api')
vi.mock('@shopify/cli-kit/shared/node/system')
vi.mock('@shopify/cli-kit/shared/node/ui')

describe('watchBulkOperation', () => {
  const mockAdminSession = {token: 'test-token', storeFqdn: 'test.myshopify.com'}
  const operationId = 'gid://shopify/BulkOperation/123'
  let abortController: AbortController

  const runningOperation = {
    id: operationId,
    status: 'RUNNING',
    objectCount: '50',
    url: null,
  }

  const completedOperation = {
    id: operationId,
    status: 'COMPLETED',
    objectCount: '100',
    url: 'https://example.com/download',
  }

  beforeEach(() => {
    abortController = new AbortController()
    vi.mocked(sleep).mockResolvedValue()
    vi.mocked(formatBulkOperationStatus).mockReturnValue(outputContent`formatted status`)
    vi.mocked(renderSingleTask).mockImplementation(async ({task, onAbort}) => {
      if (onAbort) onAbort()
      return task(() => {})
    })
  })

  test('polls until operation completes and returns the final operation', async () => {
    vi.mocked(adminRequestDoc)
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: completedOperation})

    const result = await watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})

    expect(result).toEqual(completedOperation)
    expect(adminRequestDoc).toHaveBeenCalledTimes(3)
  })

  test.each(['FAILED', 'CANCELED', 'EXPIRED'])(
    'stops polling and returns when operation status is %s',
    async (status) => {
      const terminalOperation = {
        id: operationId,
        status,
        objectCount: '25',
        url: null,
      }

      vi.mocked(adminRequestDoc)
        .mockResolvedValueOnce({bulkOperation: runningOperation})
        .mockResolvedValueOnce({bulkOperation: runningOperation})
        .mockResolvedValueOnce({bulkOperation: terminalOperation})

      const result = await watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})

      expect(result).toEqual(terminalOperation)
      expect(adminRequestDoc).toHaveBeenCalledTimes(3)
    },
  )

  test('updates the UI with latest operation status as polling progresses', async () => {
    const runningOperation1 = {...runningOperation, objectCount: '10'}
    const runningOperation2 = {...runningOperation, objectCount: '20'}
    const runningOperation3 = {...runningOperation, objectCount: '30'}

    vi.mocked(formatBulkOperationStatus)
      .mockReturnValueOnce(outputContent`processed 10 objects`)
      .mockReturnValueOnce(outputContent`processed 20 objects`)
      .mockReturnValueOnce(outputContent`processed 30 objects`)

    vi.mocked(adminRequestDoc)
      .mockResolvedValueOnce({bulkOperation: runningOperation1})
      .mockResolvedValueOnce({bulkOperation: runningOperation2})
      .mockResolvedValueOnce({bulkOperation: runningOperation3})
      .mockResolvedValueOnce({bulkOperation: completedOperation})

    const mockUpdateStatus = vi.fn()
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      return task(mockUpdateStatus)
    })

    await watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})

    expect(mockUpdateStatus).toHaveBeenNthCalledWith(1, outputContent`processed 10 objects`)
    expect(mockUpdateStatus).toHaveBeenNthCalledWith(2, outputContent`processed 20 objects`)
    expect(mockUpdateStatus).toHaveBeenNthCalledWith(3, outputContent`processed 30 objects`)
  })

  test('throws when operation not found', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: null})

    await expect(watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})).rejects.toThrow(
      'bulk operation not found',
    )
  })

  test('uses 1 second interval for first 10 polls, then 5 seconds', async () => {
    // Mock 12 running responses, then completed
    vi.mocked(adminRequestDoc)
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: completedOperation})

    await watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})

    // Verify first 10 polls use 1 second interval
    for (let i = 0; i < 10; i++) {
      expect(sleep).toHaveBeenNthCalledWith(i + 1, 1)
    }
    // Verify subsequent polls use 5 second interval
    expect(sleep).toHaveBeenNthCalledWith(11, 5)
    expect(sleep).toHaveBeenNthCalledWith(12, 5)
  })

  describe('when signal is aborted during polling', () => {
    beforeEach(() => {
      let callCount = 0
      vi.mocked(adminRequestDoc).mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          abortController.abort()
        }
        return {bulkOperation: runningOperation}
      })
    })

    test('returns current state of the operation, even if it is not terminal', async () => {
      const result = await watchBulkOperation(mockAdminSession, operationId, abortController.signal, () => {})

      expect(result.status).toBe('RUNNING')
      expect(result).toEqual(runningOperation)
    })

    test('calls the onAbort callback', async () => {
      const onAbort = vi.fn()
      await watchBulkOperation(mockAdminSession, operationId, abortController.signal, onAbort)
      expect(onAbort).toHaveBeenCalled()
    })
  })
})

describe('shortBulkOperationPoll', () => {
  const mockAdminSession = {token: 'test-token', storeFqdn: 'test.myshopify.com'}
  const operationId = 'gid://shopify/BulkOperation/123'

  const createdOperation = {
    id: operationId,
    status: 'CREATED',
    objectCount: '0',
    url: null,
  }

  const runningOperation = {
    id: operationId,
    status: 'RUNNING',
    objectCount: '50',
    url: null,
  }

  const completedOperation = {
    id: operationId,
    status: 'COMPLETED',
    objectCount: '100',
    url: 'https://example.com/download',
  }

  const failedOperation = {
    id: operationId,
    status: 'FAILED',
    objectCount: '25',
    url: null,
    errorCode: 'INTERNAL_SERVER_ERROR',
  }

  beforeEach(() => {
    vi.mocked(sleep).mockResolvedValue()
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      return task(() => {})
    })
  })

  test('returns immediately when operation is already completed', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: completedOperation})

    const result = await shortBulkOperationPoll(mockAdminSession, operationId)

    expect(result).toEqual(completedOperation)
    expect(adminRequestDoc).toHaveBeenCalledTimes(1)
  })

  test('returns immediately when operation has failed', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: failedOperation})

    const result = await shortBulkOperationPoll(mockAdminSession, operationId)

    expect(result).toEqual(failedOperation)
    expect(adminRequestDoc).toHaveBeenCalledTimes(1)
  })

  test.each(['FAILED', 'CANCELED', 'EXPIRED'])(
    'returns when operation reaches %s status within timeout',
    async (status) => {
      const terminalOperation = {
        id: operationId,
        status,
        objectCount: '25',
        url: null,
      }

      vi.mocked(adminRequestDoc)
        .mockResolvedValueOnce({bulkOperation: runningOperation})
        .mockResolvedValueOnce({bulkOperation: terminalOperation})

      const result = await shortBulkOperationPoll(mockAdminSession, operationId)

      expect(result).toEqual(terminalOperation)
    },
  )

  test('polls multiple times before returning terminal status', async () => {
    vi.mocked(adminRequestDoc)
      .mockResolvedValueOnce({bulkOperation: createdOperation})
      .mockResolvedValueOnce({bulkOperation: runningOperation})
      .mockResolvedValueOnce({bulkOperation: completedOperation})

    const result = await shortBulkOperationPoll(mockAdminSession, operationId)

    expect(result).toEqual(completedOperation)
    expect(adminRequestDoc).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledWith(QUICK_WATCH_POLL_INTERVAL_MS / 1000)
  })

  test('returns latest state when timeout is reached without terminal status', async () => {
    const originalDateNow = Date.now
    let mockTime = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      const currentTime = mockTime
      mockTime += QUICK_WATCH_TIMEOUT_MS + 1
      return currentTime
    })

    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: runningOperation})

    const result = await shortBulkOperationPoll(mockAdminSession, operationId)

    expect(result.status).toBe('RUNNING')

    vi.spyOn(Date, 'now').mockImplementation(originalDateNow)
  })
})

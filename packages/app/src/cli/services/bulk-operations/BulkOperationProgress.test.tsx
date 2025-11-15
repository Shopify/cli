import {BulkOperationProgress} from './BulkOperationProgress.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {describe, test, expect, vi, beforeEach} from 'vitest'
import {render} from '@shopify/cli-kit/node/testing/ui'
import React from 'react'

vi.mock('@shopify/cli-kit/node/api/admin')

describe('BulkOperationProgress', () => {
  const mockSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
  const operationId = 'gid://shopify/BulkOperation/123'

  beforeEach(() => {
    vi.useFakeTimers()
  })

  test('polls and calls onComplete with completed operation', async () => {
    const completedOp = {
      id: operationId,
      status: 'COMPLETED',
      objectCount: '400',
      errorCode: null,
      createdAt: '2024-01-01T00:00:00Z',
      fileSize: '409600',
      url: null,
    }

    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: completedOp})

    const onComplete = vi.fn()

    const renderInstance = render(
      <BulkOperationProgress id={operationId} adminSession={mockSession} onComplete={onComplete} />,
    )

    await vi.runAllTimersAsync()

    expect(onComplete).toHaveBeenCalledWith(completedOp)
    expect(adminRequestDoc).toHaveBeenCalledWith({
      query: expect.anything(),
      session: mockSession,
      variables: {id: operationId},
      version: '2026-01',
    })

    renderInstance.unmount()
  })

  test('polls and calls onComplete with failed operation', async () => {
    const failedOp = {
      id: operationId,
      status: 'FAILED',
      errorCode: 'INTERNAL_ERROR',
      createdAt: '2024-01-01T00:00:00Z',
      objectCount: '50',
      fileSize: '512',
      url: null,
    }

    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: failedOp})

    const onComplete = vi.fn()

    const renderInstance = render(
      <BulkOperationProgress id={operationId} adminSession={mockSession} onComplete={onComplete} />,
    )

    await vi.runAllTimersAsync()

    expect(onComplete).toHaveBeenCalledWith(failedOp)

    renderInstance.unmount()
  })

  test('polls and calls onComplete with canceled operation', async () => {
    const canceledOp = {
      id: operationId,
      status: 'CANCELED',
      errorCode: null,
      createdAt: '2024-01-01T00:00:00Z',
      objectCount: '0',
      fileSize: '0',
      url: null,
    }

    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: canceledOp})

    const onComplete = vi.fn()

    const renderInstance = render(
      <BulkOperationProgress id={operationId} adminSession={mockSession} onComplete={onComplete} />,
    )

    await vi.runAllTimersAsync()

    expect(onComplete).toHaveBeenCalledWith(canceledOp)

    renderInstance.unmount()
  })

  test('calls onComplete with null when operation not found', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: null})

    const onComplete = vi.fn()

    const renderInstance = render(
      <BulkOperationProgress id={operationId} adminSession={mockSession} onComplete={onComplete} />,
    )

    await vi.runAllTimersAsync()

    expect(onComplete).toHaveBeenCalledWith(null)

    renderInstance.unmount()
  })

  test('continues polling until terminal status', async () => {
    const runningOp = {
      id: operationId,
      status: 'RUNNING',
      objectCount: '200',
      errorCode: null,
      createdAt: '2024-01-01T00:00:00Z',
      fileSize: '204800',
      url: null,
    }

    const completedOp = {...runningOp, status: 'COMPLETED', objectCount: '400'}

    vi.mocked(adminRequestDoc).mockResolvedValueOnce({bulkOperation: runningOp})
    vi.mocked(adminRequestDoc).mockResolvedValueOnce({bulkOperation: completedOp})

    const onComplete = vi.fn()

    const renderInstance = render(
      <BulkOperationProgress id={operationId} adminSession={mockSession} onComplete={onComplete} />,
    )

    await vi.runAllTimersAsync()

    expect(adminRequestDoc).toHaveBeenCalledTimes(2)
    expect(onComplete).toHaveBeenCalledWith(completedOp)

    renderInstance.unmount()
  })
})

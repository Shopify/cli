import {waitForOperations} from './wait-for-operations.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test, vi} from 'vitest'
import type {
  MigrationOperation,
  MigrationOperationStatus,
  MigrationResultCode,
} from '../../models/subscription-migrations.js'

function operation(
  id: string,
  status: MigrationOperationStatus,
  total = 1,
  resultCodes: MigrationResultCode[] = [],
): MigrationOperation {
  return {
    id,
    status,
    total,
    results: {
      edges: resultCodes.map((code, index) => ({node: {shopId: `gid://shopify/Shop/${index + 1}`, code}})),
    },
  }
}

describe('waitForOperations', () => {
  test('returns all terminal operations immediately in input ID order', async () => {
    const terminalOperations = new Map([
      ['one', operation('one', 'COMPLETED')],
      ['two', operation('two', 'FAILED')],
      ['three', operation('three', 'CANCELED')],
    ])
    const getOperation = vi.fn(({operationId}: {operationId: string}) =>
      Promise.resolve(terminalOperations.get(operationId) ?? null),
    )
    const sleep = vi.fn()

    await expect(
      waitForOperations({clientId: 'client-id', operationIds: ['three', 'one', 'two'], getOperation, sleep}),
    ).resolves.toEqual([operation('three', 'CANCELED'), operation('one', 'COMPLETED'), operation('two', 'FAILED')])
    expect(getOperation).toHaveBeenCalledTimes(3)
    expect(sleep).not.toHaveBeenCalled()
  })

  test('polls only running operations until every ID is terminal', async () => {
    const getOperation = vi
      .fn()
      .mockResolvedValueOnce(operation('one', 'COMPLETED'))
      .mockResolvedValueOnce(operation('two', 'RUNNING'))
      .mockResolvedValueOnce(operation('two', 'RUNNING'))
      .mockResolvedValueOnce(operation('two', 'COMPLETED'))
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await waitForOperations({
      clientId: 'client-id',
      operationIds: ['one', 'two'],
      pollIntervalMs: 25,
      getOperation,
      sleep,
    })

    expect(result).toEqual([operation('one', 'COMPLETED'), operation('two', 'COMPLETED')])
    expect(getOperation).toHaveBeenCalledTimes(4)
    expect(getOperation).toHaveBeenNthCalledWith(3, {clientId: 'client-id', operationId: 'two'})
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(25)
  })

  test('sends the first fetched snapshot to the update callback', async () => {
    const completed = operation('one', 'COMPLETED')
    const onUpdate = vi.fn()

    await waitForOperations({
      clientId: 'client-id',
      operationIds: ['one'],
      getOperation: vi.fn().mockResolvedValue(completed),
      sleep: vi.fn(),
      onUpdate,
    })

    expect(onUpdate).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenCalledWith([completed])
  })

  test('waits for the update callback before completing', async () => {
    let releaseUpdate: (() => void) | undefined
    const onUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseUpdate = resolve
        }),
    )
    let hasCompleted = false

    const waiting = waitForOperations({
      clientId: 'client-id',
      operationIds: ['one'],
      getOperation: vi.fn().mockResolvedValue(operation('one', 'COMPLETED')),
      sleep: vi.fn(),
      onUpdate,
    })
    const completion = waiting.then(() => {
      hasCompleted = true
    })
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledOnce())

    expect(hasCompleted).toBe(false)
    releaseUpdate?.()
    await completion
    expect(hasCompleted).toBe(true)
  })

  test('does not send an update for an identical running snapshot', async () => {
    const running = operation('one', 'RUNNING')
    const completed = operation('one', 'COMPLETED')
    const getOperation = vi
      .fn()
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(structuredClone(running))
      .mockResolvedValueOnce(completed)
    const onUpdate = vi.fn()

    await waitForOperations({
      clientId: 'client-id',
      operationIds: ['one'],
      getOperation,
      sleep: vi.fn(),
      onUpdate,
    })

    expect(onUpdate).toHaveBeenCalledTimes(2)
    expect(onUpdate).toHaveBeenNthCalledWith(1, [running])
    expect(onUpdate).toHaveBeenNthCalledWith(2, [completed])
  })

  test('sends an update when total, results, codes, or status changes', async () => {
    const snapshots = [
      operation('one', 'RUNNING', 1),
      operation('one', 'RUNNING', 2),
      operation('one', 'RUNNING', 2, ['SCHEDULED']),
      operation('one', 'RUNNING', 2, ['INTERNAL_ERROR']),
      operation('one', 'COMPLETED', 2, ['INTERNAL_ERROR']),
    ]
    const getOperation = vi.fn()
    for (const snapshot of snapshots) getOperation.mockResolvedValueOnce(snapshot)
    const onUpdate = vi.fn()

    await waitForOperations({
      clientId: 'client-id',
      operationIds: ['one'],
      getOperation,
      sleep: vi.fn(),
      onUpdate,
    })

    expect(onUpdate).toHaveBeenCalledTimes(snapshots.length)
    snapshots.forEach((snapshot, index) => {
      expect(onUpdate).toHaveBeenNthCalledWith(index + 1, [snapshot])
    })
  })

  test('sends full snapshots in input ID order until every operation is terminal', async () => {
    const completedOne = operation('one', 'COMPLETED')
    const runningTwo = operation('two', 'RUNNING')
    const completedTwo = operation('two', 'COMPLETED')
    const getOperation = vi
      .fn()
      .mockResolvedValueOnce(runningTwo)
      .mockResolvedValueOnce(completedOne)
      .mockResolvedValueOnce(completedTwo)
    const onUpdate = vi.fn()

    await waitForOperations({
      clientId: 'client-id',
      operationIds: ['two', 'one'],
      getOperation,
      sleep: vi.fn(),
      onUpdate,
    })

    expect(onUpdate).toHaveBeenNthCalledWith(1, [runningTwo, completedOne])
    expect(onUpdate).toHaveBeenNthCalledWith(2, [completedTwo, completedOne])
  })

  test('throws an AbortError when an operation cannot be found', async () => {
    const getOperation = vi.fn().mockResolvedValue(null)

    const promise = waitForOperations({
      clientId: 'client-id',
      operationIds: ['missing'],
      getOperation,
      sleep: vi.fn(),
    })

    await expect(promise).rejects.toBeInstanceOf(AbortError)
    await expect(promise).rejects.toThrow('Migration operation not found: missing')
  })
})

import {batchedRequests, batchedTasks} from './batching.js'
import {describe, expect, test, vi} from 'vitest'

describe('batchedRequests', () => {
  test('splits items into batches of the given size, keeping a smaller final batch', async () => {
    // Given
    const fn = vi.fn(async (_batch: number[]) => undefined)

    // When
    await Promise.all(batchedRequests([1, 2, 3, 4, 5], 2, fn))

    // Then
    expect(fn.mock.calls.map(([batch]) => batch)).toEqual([[1, 2], [3, 4], [5]])
  })

  test('returns one promise per batch resolving to the callback result', async () => {
    // Given
    const fn = async (batch: number[]) => batch.length

    // When
    const requests = batchedRequests([1, 2, 3, 4, 5], 2, fn)

    // Then
    await expect(Promise.all(requests)).resolves.toEqual([2, 2, 1])
  })

  test('does not invoke the callback when there are no items', () => {
    // Given
    const fn = vi.fn(async () => undefined)

    // When
    const requests = batchedRequests([], 2, fn)

    // Then
    expect(requests).toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  test('emits a single batch when the batch size exceeds the number of items', async () => {
    // Given
    const fn = vi.fn(async () => undefined)

    // When
    await Promise.all(batchedRequests([1, 2], 50, fn))

    // Then
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith([1, 2])
  })
})

describe('batchedTasks', () => {
  test('builds one task per batch and passes the index of the first item in the batch', () => {
    // Given
    const items = ['a', 'b', 'c', 'd', 'e']

    // When
    const tasks = batchedTasks(items, 2, (batch, start) => ({
      title: `${start}:${batch.join('')}`,
      task: async () => {},
    }))

    // Then
    expect(tasks.map((task) => task.title)).toEqual(['0:ab', '2:cd', '4:e'])
  })

  test('returns no tasks when there are no items', () => {
    // Given
    const fn = vi.fn(() => ({title: 'unused', task: async () => {}}))

    // When
    const tasks = batchedTasks([], 2, fn)

    // Then
    expect(tasks).toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  test('defers work until a task is run', async () => {
    // Given
    const run = vi.fn(async (_batch: number[]) => undefined)

    // When
    const tasks = batchedTasks([1, 2], 1, (batch) => ({title: 'download', task: async () => run(batch)}))

    // Then
    expect(run).not.toHaveBeenCalled()
    await Promise.all(tasks.map((task) => task.task()))
    expect(run.mock.calls.map(([batch]) => batch)).toEqual([[1], [2]])
  })
})

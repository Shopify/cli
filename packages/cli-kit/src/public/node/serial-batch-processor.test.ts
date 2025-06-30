import {SerialBatchProcessor} from './serial-batch-processor.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

describe('SerialBatchProcessor', () => {
  let processBatchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Default mock that resolves immediately
    processBatchMock = vi.fn(async (_items: string[]) => Promise.resolve())
  })

  test('should process a single item in a batch', async () => {
    const processor = new SerialBatchProcessor<string>(processBatchMock)
    processor.enqueue('item1')
    await processor.waitForCompletion()

    expect(processBatchMock).toHaveBeenCalledTimes(1)
    expect(processBatchMock).toHaveBeenCalledWith(['item1'])
  })

  test('should process items in separate batches if enqueued after processing of a batch starts', async () => {
    let resolveFirstBatch: () => void = () => {}

    processBatchMock.mockImplementationOnce(async (_items: string[]) => {
      await new Promise<void>((resolve) => {
        resolveFirstBatch = resolve
      })
    })

    const processor = new SerialBatchProcessor<string>(processBatchMock)

    // Enqueue first item, processing will start and pause
    processor.enqueue('itemA')

    // Enqueue second item while first is "processing"
    processor.enqueue('itemB')

    // Complete processing of the first batch
    resolveFirstBatch()

    // Wait for all processing to complete
    await processor.waitForCompletion()

    expect(processBatchMock).toHaveBeenCalledTimes(2)
    expect(processBatchMock).toHaveBeenNthCalledWith(1, ['itemA'])
    expect(processBatchMock).toHaveBeenNthCalledWith(2, ['itemB'])
  })

  test('waitForCompletion should resolve after all batches are processed', async () => {
    let resolveFirstBatch: () => void = () => {}
    const firstBatchPromise = new Promise<void>((resolve) => (resolveFirstBatch = resolve))
    let resolveSecondBatch: () => void = () => {}
    const secondBatchPromise = new Promise<void>((resolve) => (resolveSecondBatch = resolve))

    processBatchMock
      .mockImplementationOnce(async (_items: string[]) => firstBatchPromise)
      .mockImplementationOnce(async (_items: string[]) => secondBatchPromise)

    const processor = new SerialBatchProcessor<string>(processBatchMock)
    // Starts first batch
    processor.enqueue('item1')
    // Queued for second batch
    processor.enqueue('item2')

    let completed = false
    const completionPromise = processor.waitForCompletion().then(() => {
      completed = true
    })

    expect(completed).toBe(false)

    resolveFirstBatch()

    // Still waiting for the second batch
    expect(completed).toBe(false)

    resolveSecondBatch()
    // Ensure it resolves
    await completionPromise
    expect(completed).toBe(true)
    expect(processBatchMock).toHaveBeenCalledTimes(2)
  })

  test('waitForCompletion should resolve immediately if no items are queued and no processing is active', async () => {
    const processor = new SerialBatchProcessor<string>(processBatchMock)
    await processor.waitForCompletion()
    expect(processBatchMock).not.toHaveBeenCalled()
  })

  test('processBatch errors should propagate and processingPromise should be reset allowing future processing', async () => {
    const testError = new Error('Batch processing failed')
    processBatchMock.mockImplementationOnce(async () => {
      throw testError
    })

    const processor = new SerialBatchProcessor<string>(processBatchMock)

    processor.enqueue('item1-fail')

    await expect(processor.waitForCompletion()).rejects.toThrow(testError)

    // Reset mock for the next successful attempt
    processBatchMock.mockImplementationOnce(async (_items: string[]) => Promise.resolve())

    // Enqueue another item, should start new processing
    processor.enqueue('item2-success')
    await processor.waitForCompletion()
    // First call failed, second succeeded
    expect(processBatchMock).toHaveBeenCalledTimes(2)
    expect(processBatchMock).toHaveBeenLastCalledWith(['item2-success'])
  })
})

/**
 * Handles serial processing of items with automatic batching
 * Only one processing operation runs at a time, with new items
 * automatically queued for the next batch.
 */
export class SerialBatchProcessor<T> {
  processBatch?: (items: T[]) => Promise<void>

  private queue: T[] = []
  private processingPromise: Promise<void> | undefined = undefined

  enqueue(item: T): void {
    this.queue.push(item)

    if (!this.processingPromise) {
      this.processingPromise = this.startProcessing()
    }
  }

  async waitForCompletion(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise
    }
  }

  private async startProcessing(): Promise<void> {
    try {
      while (this.queue.length > 0) {
        // Get current batch and clear queue
        const batch = [...this.queue]
        this.queue = []

        // Process the current batch
        // eslint-disable-next-line no-await-in-loop
        await this.processBatch?.(batch)
      }
    } finally {
      // Always make sure we reset the processing state
      this.processingPromise = undefined
    }
  }
}

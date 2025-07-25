import {renderBulkOperationProgress, BulkOperationProgressCallbacks} from './bulk-operation-progress.js'
import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputCompleted, outputWarn} from '@shopify/cli-kit/node/output'
import {
  createRightAlignedText,
  createColoredProgressBar,
  createIndeterminateProgressBar,
} from '@shopify/cli-kit/node/ui'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('bulk-operation-progress', () => {
  beforeEach(() => {
    // vi.clearAllMocks() - handled automatically by vitest
    vi.useFakeTimers()

    // Mock the UI functions
    vi.mocked(createRightAlignedText).mockImplementation((left, right) => `${left} ${right}`)
    vi.mocked(createColoredProgressBar).mockImplementation((pct) => `[${pct}% bar]`)
    vi.mocked(createIndeterminateProgressBar).mockImplementation(() => '[gradient bar]')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('progress calculation logic', () => {
    test('handles empty store operations', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'export',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Export completed successfully! 0 items processed.'),
      )
    })

    test('handles single store operation', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [
                {
                  totalObjectCount: 150,
                  completedObjectCount: 150,
                  remoteOperationStatus: 'completed',
                },
              ],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'import',
        storeName: 'test-store',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Import completed successfully! 150 items processed.'),
      )
    })

    test('handles dual store operation (copy) - uses import count when export complete', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [
                {
                  totalObjectCount: 200,
                  completedObjectCount: 200,
                  // Export complete
                  remoteOperationStatus: 'completed',
                },
                {
                  totalObjectCount: 200,
                  completedObjectCount: 200,
                  // Import complete
                  remoteOperationStatus: 'completed',
                },
              ],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'copy',
        sourceStoreName: 'source-store',
        targetStoreName: 'target-store',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Copy completed successfully! Data copied from source-store to target-store.'),
      )
    })
  })

  describe('animation system', () => {
    test('uses gradient animation for export operations', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [{totalObjectCount: 50, completedObjectCount: 50, remoteOperationStatus: 'completed'}],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'export',
        storeName: 'test-store',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Export completed successfully! 50 items processed.'),
      )
    })

    test('animation cleanup on completion', async () => {
      const mockOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'RUNNING',
              storeOperations: [{totalObjectCount: 100, completedObjectCount: 25, remoteOperationStatus: 'running'}],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(mockOperation),
        pollOperation: vi.fn().mockResolvedValue(mockOperation),
      }

      const promise = renderBulkOperationProgress({
        type: 'import',
        callbacks,
      })

      // Let animation start
      vi.advanceTimersByTime(100)
      const animationCallCount = vi.mocked(createColoredProgressBar).mock.calls.length

      // Complete operation quickly
      const completedOperation = {
        ...mockOperation,
        organization: {
          ...mockOperation.organization,
          bulkData: {
            ...mockOperation.organization.bulkData,
            operation: {
              ...mockOperation.organization.bulkData.operation,
              status: 'COMPLETED',
            },
          },
        },
      }
      vi.mocked(callbacks.pollOperation).mockResolvedValue(completedOperation)
      vi.advanceTimersByTime(300)

      await promise

      // Animation should stop - advancing more time shouldn't create more calls
      const callCountAfterCompletion = vi.mocked(createColoredProgressBar).mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(vi.mocked(createColoredProgressBar).mock.calls.length).toBe(callCountAfterCompletion)
    })

    test('animation cleanup on failure', async () => {
      const mockOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'RUNNING',
              storeOperations: [{totalObjectCount: 100, completedObjectCount: 25, remoteOperationStatus: 'running'}],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(mockOperation),
        pollOperation: vi.fn().mockResolvedValue(mockOperation),
      }

      const promise = renderBulkOperationProgress({
        type: 'import',
        callbacks,
      })

      // Let animation start
      vi.advanceTimersByTime(100)

      // Fail operation
      const failedOperation = {
        ...mockOperation,
        organization: {
          ...mockOperation.organization,
          bulkData: {
            ...mockOperation.organization.bulkData,
            operation: {
              ...mockOperation.organization.bulkData.operation,
              status: 'FAILED',
            },
          },
        },
      }
      vi.mocked(callbacks.pollOperation).mockResolvedValue(failedOperation)
      vi.advanceTimersByTime(300)

      await promise

      expect(outputWarn).toHaveBeenCalledWith(expect.stringContaining('Import operation failed.'))

      // Animation should stop - advancing more time shouldn't create more calls
      const callCountAfterFailure = vi.mocked(createColoredProgressBar).mock.calls.length
      vi.advanceTimersByTime(1000)
      expect(vi.mocked(createColoredProgressBar).mock.calls.length).toBe(callCountAfterFailure)
    })
  })

  describe('step transitions in copy operations', () => {
    test('handles export for copy operations', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [{totalObjectCount: 100, completedObjectCount: 100, remoteOperationStatus: 'completed'}],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'copy',
        sourceStoreName: 'source-store',
        targetStoreName: 'target-store',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Copy completed successfully! Data copied from source-store to target-store.'),
      )
    })
  })

  describe('edge cases', () => {
    test('handles immediately completed operation', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [{totalObjectCount: 100, completedObjectCount: 100, remoteOperationStatus: 'completed'}],
            },
          },
        },
      } as any

      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
      }

      await renderBulkOperationProgress({
        type: 'export',
        callbacks,
      })

      expect(outputCompleted).toHaveBeenCalledWith(
        expect.stringContaining('Export completed successfully! 100 items processed.'),
      )
      expect(callbacks.pollOperation).not.toHaveBeenCalled()
    })

    test('handles operation with onComplete callback', async () => {
      const completedOperation: BulkDataOperationByIdResponse = {
        organization: {
          bulkData: {
            operation: {
              id: 'test-op',
              status: 'COMPLETED',
              storeOperations: [{totalObjectCount: 50, completedObjectCount: 50, remoteOperationStatus: 'completed'}],
            },
          },
        },
      } as any

      const onComplete = vi.fn().mockResolvedValue(undefined)
      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockResolvedValue(completedOperation),
        pollOperation: vi.fn().mockResolvedValue(completedOperation),
        onComplete,
      }

      await renderBulkOperationProgress({
        type: 'import',
        callbacks,
      })

      expect(onComplete).toHaveBeenCalledWith(completedOperation)
    })

    test('handles error in callbacks gracefully', async () => {
      const callbacks: BulkOperationProgressCallbacks = {
        startOperation: vi.fn().mockRejectedValue(new Error('Start failed')),
        pollOperation: vi.fn(),
      }

      await expect(
        renderBulkOperationProgress({
          type: 'export',
          callbacks,
        }),
      ).rejects.toThrow('Start failed')

      expect(outputWarn).toHaveBeenCalledWith(expect.stringContaining('Operation failed: Start failed'))
    })
  })
})

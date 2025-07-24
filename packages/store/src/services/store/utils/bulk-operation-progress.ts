import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputInfo, outputCompleted, outputWarn} from '@shopify/cli-kit/node/output'

export interface BulkOperationProgressCallbacks {
  startOperation: () => Promise<unknown>
  pollOperation: (operationId: string) => Promise<unknown>
  onComplete?: (operation: unknown) => Promise<void>
}

interface RenderBulkOperationProgressOptions {
  type: 'export' | 'import'
  callbacks: BulkOperationProgressCallbacks
  storeName?: string
}

interface RenderCopyOperationProgressOptions {
  type: 'copy'
  callbacks: BulkOperationProgressCallbacks
  sourceStoreName: string
  targetStoreName: string
}

function extractStoreProgress(operation: unknown): {
  totalObjectCount: number
  completedObjectCount: number
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeOperations = (operation as any).organization.bulkData.operation.storeOperations

  if (!storeOperations || storeOperations.length === 0) {
    return {totalObjectCount: 0, completedObjectCount: 0}
  }

  if (storeOperations.length === 1) {
    const firstOp = storeOperations[0]
    if (!firstOp) {
      return {totalObjectCount: 0, completedObjectCount: 0}
    }
    return {
      totalObjectCount: firstOp.totalObjectCount || 0,
      completedObjectCount: firstOp.completedObjectCount || 0,
    }
  }

  if (storeOperations.length === 2) {
    const firstOp = storeOperations[0]
    const secondOp = storeOperations[1]

    if (!firstOp || !secondOp) {
      return {totalObjectCount: 0, completedObjectCount: 0}
    }

    const firstOpStatus = firstOp.remoteOperationStatus

    if (firstOpStatus === 'completed' || firstOpStatus === 'failed') {
      return {
        totalObjectCount: secondOp.totalObjectCount || 0,
        completedObjectCount: secondOp.completedObjectCount || 0,
      }
    } else {
      return {
        totalObjectCount: firstOp.totalObjectCount || 0,
        completedObjectCount: firstOp.completedObjectCount || 0,
      }
    }
  }

  return {totalObjectCount: 0, completedObjectCount: 0}
}

function getStatusMessage(
  options: RenderBulkOperationProgressOptions | RenderCopyOperationProgressOptions,
  status: 'completed' | 'failed',
  completedCount: number,
) {
  if (status === 'completed') {
    return options.type === 'copy'
      ? `Copy completed successfully! Data copied from ${options.sourceStoreName} to ${options.targetStoreName}.`
      : `${
          options.type.charAt(0).toUpperCase() + options.type.slice(1)
        } completed successfully! ${completedCount} items processed.`
  } else {
    return options.type === 'copy'
      ? 'Copy operation failed.'
      : `${options.type.charAt(0).toUpperCase() + options.type.slice(1)} operation failed.`
  }
}

export async function renderBulkOperationProgress(
  options: RenderBulkOperationProgressOptions | RenderCopyOperationProgressOptions,
): Promise<BulkDataOperationByIdResponse> {
  let lastMessage = ''

  const updateProgress = (message: string) => {
    if (message !== lastMessage) {
      outputInfo(message)
      lastMessage = message
    }
  }

  try {
    // Start the operation
    const operation = await options.callbacks.startOperation()
    const initialProgress = extractStoreProgress(operation)
    const initialStatus = operation.organization.bulkData.operation.status

    if (initialStatus === 'COMPLETED') {
      const message = getStatusMessage(options, 'completed', initialProgress.completedObjectCount)
      outputCompleted(message)

      if (options.callbacks.onComplete) {
        await options.callbacks.onComplete(operation)
      }
      return operation as BulkDataOperationByIdResponse
    }

    if (initialStatus === 'FAILED') {
      const message = getStatusMessage(options, 'failed', initialProgress.completedObjectCount)
      outputWarn(message)

      if (options.callbacks.onComplete) {
        await options.callbacks.onComplete(operation)
      }
      return operation as BulkDataOperationByIdResponse
    }

    // Show initial progress
    if (options.type === 'copy') {
      updateProgress(`Starting copy operation from ${options.sourceStoreName} to ${options.targetStoreName}...`)
    } else {
      const storeName = options.storeName
      updateProgress(
        `Starting ${options.type} operation${
          storeName ? ` ${options.type === 'export' ? 'from' : 'to'} ${storeName}` : ''
        }...`,
      )
    }

    // Poll for updates
    const operationId = operation.organization.bulkData.operation.id
    let currentOperation = operation

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 500))

      // eslint-disable-next-line no-await-in-loop
      currentOperation = await options.callbacks.pollOperation(operationId)
      const progress = extractStoreProgress(currentOperation)
      const status = currentOperation.organization.bulkData.operation.status

      if (status === 'RUNNING' && progress.totalObjectCount > 0) {
        if (options.type === 'copy') {
          // Determine phase for copy operations
          const storeOps = currentOperation.organization.bulkData.operation.storeOperations
          if (storeOps?.length === 1) {
            updateProgress(
              `Exporting from ${options.sourceStoreName}: ${progress.completedObjectCount} objects exported`,
            )
          } else if (storeOps?.length === 2) {
            const [exportOp, _importOp] = storeOps
            if (exportOp?.remoteOperationStatus === 'completed') {
              const percentage = Math.round((progress.completedObjectCount / progress.totalObjectCount) * 100)
              updateProgress(
                `Importing to ${options.targetStoreName}: ${progress.completedObjectCount}/${progress.totalObjectCount} (${percentage}%)`,
              )
            } else {
              updateProgress(
                `Exporting from ${options.sourceStoreName}: ${progress.completedObjectCount} objects exported`,
              )
            }
          }
        } else if (options.type === 'export') {
          updateProgress(
            `Exporting${options.storeName ? ` from ${options.storeName}` : ''}: ${
              progress.completedObjectCount
            } objects exported`,
          )
        } else if (options.type === 'import') {
          const percentage = Math.round((progress.completedObjectCount / progress.totalObjectCount) * 100)
          updateProgress(
            `Importing${options.storeName ? ` to ${options.storeName}` : ''}: ${progress.completedObjectCount}/${
              progress.totalObjectCount
            } (${percentage}%)`,
          )
        }
      }

      if (status === 'COMPLETED' || status === 'FAILED') {
        const message = getStatusMessage(
          options,
          status === 'COMPLETED' ? 'completed' : 'failed',
          progress.completedObjectCount,
        )
        if (status === 'COMPLETED') {
          outputCompleted(message)
        } else {
          outputWarn(message)
        }

        if (options.callbacks.onComplete) {
          // eslint-disable-next-line no-await-in-loop
          await options.callbacks.onComplete(currentOperation)
        }
        return currentOperation as BulkDataOperationByIdResponse
      }
    }
  } catch (error) {
    outputWarn(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

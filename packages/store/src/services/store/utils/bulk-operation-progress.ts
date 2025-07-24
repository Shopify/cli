import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputInfo, outputCompleted, outputWarn} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'

function getTerminalWidth(): number {
  return process.stdout.columns || 80
}

function createRightAlignedText(leftText: string, rightText: string, terminalWidth: number): string {
  // -1 for spacing
  const maxLeftWidth = terminalWidth - rightText.length - 1
  const truncatedLeftText = leftText.length > maxLeftWidth ? `${leftText.slice(0, maxLeftWidth - 3)}...` : leftText
  const padding = Math.max(0, terminalWidth - truncatedLeftText.length - rightText.length)
  return truncatedLeftText + ' '.repeat(padding) + rightText
}

function createColoredProgressBar(percentage: number, terminalWidth: number): string {
  // Use full terminal width for progress bar
  const width = Math.max(20, terminalWidth)

  const filled = Math.round((percentage / 100) * width)
  const empty = width - filled

  // Create a more subtle gradient - green for filled, gray for empty
  const filledChar = '█'
  const emptyChar = '█'

  const filledBar = filledChar.repeat(filled)
  const emptyBar = emptyChar.repeat(empty)

  // Use green for filled portion and dim gray for empty
  return colors.green(filledBar) + colors.dim(emptyBar)
}

function createIndeterminateColorBar(terminalWidth: number): string {
  // Use full terminal width for progress bar
  const width = Math.max(20, terminalWidth)

  const filledChar = '█'
  const bar = filledChar.repeat(width)
  // Use cyan/blue gradient for indeterminate (export) operations
  return colors.cyan(bar.slice(0, Math.floor(width * 0.4))) + colors.blue(bar.slice(Math.floor(width * 0.4)))
}

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
  let currentStep = ''
  let isFirstProgressUpdate = true

  const updateProgress = (message: string, isProgressUpdate = false) => {
    // For progress updates, always update even if message is similar (counts change frequently)
    if (isProgressUpdate || message !== lastMessage) {
      if (isProgressUpdate && !isFirstProgressUpdate) {
        // Clear the previous progress lines and move cursor up
        // Clear current line and return to start
        process.stdout.write('\x1b[2K\r')
        // Move up one line, clear it, return to start
        process.stdout.write('\x1b[1A\x1b[2K\r')
        // Move up another line for the progress bar, clear it
        process.stdout.write('\x1b[1A\x1b[2K\r')
      }
      outputInfo(message)
      lastMessage = message
      if (isProgressUpdate) {
        isFirstProgressUpdate = false
      }
    }
  }

  const updateStep = (step: string) => {
    if (step !== currentStep) {
      // Add extra spacing before new steps (except the first one)
      if (currentStep !== '') {
        outputInfo('')
      }
      outputInfo(step)
      currentStep = step
      // Reset for new step
      isFirstProgressUpdate = true
    }
  }

  try {
    // Start the operation
    const operation = await options.callbacks.startOperation()
    const initialProgress = extractStoreProgress(operation)
    const initialStatus = (operation as BulkDataOperationByIdResponse).organization.bulkData.operation.status

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
    const operationId = (operation as BulkDataOperationByIdResponse).organization.bulkData.operation.id
    let currentOperation = operation as BulkDataOperationByIdResponse

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 300))

      // eslint-disable-next-line no-await-in-loop
      currentOperation = (await options.callbacks.pollOperation(operationId)) as BulkDataOperationByIdResponse
      const progress = extractStoreProgress(currentOperation)
      const status = currentOperation.organization.bulkData.operation.status

      if (status === 'RUNNING' && progress.totalObjectCount > 0) {
        if (options.type === 'copy') {
          // Determine phase for copy operations
          const storeOps = currentOperation.organization.bulkData.operation.storeOperations
          if (storeOps?.length === 1) {
            updateStep('Step 1 of 2')
            const terminalWidth = getTerminalWidth()
            const progressBar = createIndeterminateColorBar(terminalWidth)
            const statusText = createRightAlignedText(
              `Exporting from ${options.sourceStoreName}...`,
              `${progress.completedObjectCount} objects`,
              terminalWidth,
            )
            updateProgress(`${progressBar}\n${statusText}`, true)
          } else if (storeOps?.length === 2) {
            const [exportOp, _importOp] = storeOps
            if (exportOp?.remoteOperationStatus === 'completed') {
              updateStep('Step 2 of 2')
              const terminalWidth = getTerminalWidth()
              const percentage = Math.round((progress.completedObjectCount / progress.totalObjectCount) * 100)
              const progressBar = createColoredProgressBar(percentage, terminalWidth)
              const statusText = createRightAlignedText(
                `Importing to ${options.targetStoreName}...`,
                `${progress.completedObjectCount} / ${progress.totalObjectCount}`,
                terminalWidth,
              )
              updateProgress(`${progressBar}\n${statusText}`, true)
            } else {
              updateStep('Step 1 of 2')
              const terminalWidth = getTerminalWidth()
              const progressBar = createIndeterminateColorBar(terminalWidth)
              const statusText = createRightAlignedText(
                `Exporting from ${options.sourceStoreName}...`,
                `${progress.completedObjectCount} objects`,
                terminalWidth,
              )
              updateProgress(`${progressBar}\n${statusText}`, true)
            }
          }
        } else if (options.type === 'export') {
          const terminalWidth = getTerminalWidth()
          const progressBar = createIndeterminateColorBar(terminalWidth)
          const statusText = createRightAlignedText(
            `Exporting${options.storeName ? ` from ${options.storeName}` : ''}...`,
            `${progress.completedObjectCount} objects`,
            terminalWidth,
          )
          updateProgress(`${progressBar}\n${statusText}`, true)
        } else if (options.type === 'import') {
          const terminalWidth = getTerminalWidth()
          const percentage = Math.round((progress.completedObjectCount / progress.totalObjectCount) * 100)
          const progressBar = createColoredProgressBar(percentage, terminalWidth)
          const statusText = createRightAlignedText(
            `Importing${options.storeName ? ` to ${options.storeName}` : ''}...`,
            `${progress.completedObjectCount} / ${progress.totalObjectCount}`,
            terminalWidth,
          )
          updateProgress(`${progressBar}\n${statusText}`, true)
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
        return currentOperation
      }
    }
  } catch (error) {
    outputWarn(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

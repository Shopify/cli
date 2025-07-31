import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputInfo, outputCompleted, outputWarn} from '@shopify/cli-kit/node/output'
import {
  createRightAlignedText,
  createColoredProgressBar,
  createIndeterminateProgressBar,
  clearLines,
  createAnimatedDots,
} from '@shopify/cli-kit/node/ui'
import colors from '@shopify/cli-kit/node/colors'

const POLLING_INTERVAL_MS = 300
const ANIMATION_INTERVAL_MS = 40
const DOT_ANIMATION_SLOWDOWN_FACTOR = 16

export function isOperationComplete(operation: {remoteOperationStatus?: string}): boolean {
  return operation.remoteOperationStatus === 'completed' || operation.remoteOperationStatus === 'failed'
}

export function renderExportProgress(completedCount: number, animationIteration = 0): string {
  const progressBar = createIndeterminateProgressBar(animationIteration)
  const rightText = completedCount > 0 ? `${completedCount} ${colors.dim('items processed')}` : ''
  const dots = createAnimatedDots(Math.floor(animationIteration / DOT_ANIMATION_SLOWDOWN_FACTOR))
  const statusText = createRightAlignedText(`Exporting${dots}`, rightText)
  return `${progressBar}\n\n${statusText}`
}

export function renderImportProgress(completedCount: number, totalCount: number, animationIteration = 0): string {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const progressBar = createColoredProgressBar(percentage)
  const rightText = totalCount > 0 ? `${completedCount} ${colors.dim(`/ ${totalCount}`)}` : ''
  const dots = createAnimatedDots(Math.floor(animationIteration / DOT_ANIMATION_SLOWDOWN_FACTOR))
  const statusText = createRightAlignedText(`Importing${dots}`, rightText)
  return `${progressBar}\n\n${statusText}`
}

function getLineCount(text: string): number {
  return text.split('\n').length
}

async function handleOperationCompletion(
  operation: BulkDataOperationByIdResponse,
  getCompletionMessage: (status: 'completed' | 'failed', completedCount: number) => string,
): Promise<void> {
  const status = operation.organization.bulkData.operation.status
  const firstOp = operation.organization.bulkData.operation.storeOperations?.[0]
  const completedCount = firstOp?.completedObjectCount ?? 0
  const message = getCompletionMessage(status === 'COMPLETED' ? 'completed' : 'failed', completedCount)
  if (status === 'COMPLETED') {
    outputCompleted(message)
  } else {
    outputWarn(message)
  }
}

async function pollWithAnimation(
  pollOperation: (operationId: string) => Promise<BulkDataOperationByIdResponse>,
  operationId: string,
  renderProgress: (operation: BulkDataOperationByIdResponse, animationIteration: number) => string,
  updateProgress: (message: string, isProgressUpdate?: boolean) => void,
): Promise<BulkDataOperationByIdResponse> {
  let currentOperation: BulkDataOperationByIdResponse
  let animationIteration = 0

  const animationInterval = setInterval(() => {
    if (
      !currentOperation ||
      currentOperation.organization.bulkData.operation.status === 'COMPLETED' ||
      currentOperation.organization.bulkData.operation.status === 'FAILED'
    )
      return

    const progressContent = renderProgress(currentOperation, animationIteration)
    if (progressContent) {
      updateProgress(progressContent, true)
    }
    animationIteration++
  }, ANIMATION_INTERVAL_MS)

  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      currentOperation = await pollOperation(operationId)
      const status = currentOperation.organization.bulkData.operation.status

      if (status === 'COMPLETED' || status === 'FAILED') {
        clearInterval(animationInterval)

        const finalContent = renderProgress(currentOperation, 0)
        if (finalContent) {
          updateProgress(`${finalContent}\n`, true)
        }

        return currentOperation
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS))
    }
  } finally {
    clearInterval(animationInterval)
  }
}

export async function renderProgressWithPolling(
  startOperation: () => Promise<BulkDataOperationByIdResponse>,
  pollOperation: (operationId: string) => Promise<BulkDataOperationByIdResponse>,
  renderProgress: (operation: BulkDataOperationByIdResponse, animationIteration: number) => string,
  getInitialMessage: () => string,
  getCompletionMessage: (status: 'completed' | 'failed', completedCount: number) => string,
): Promise<BulkDataOperationByIdResponse> {
  let lastMessage = ''

  const updateProgress = (message: string, isProgressUpdate = false) => {
    if (isProgressUpdate || message !== lastMessage) {
      if (isProgressUpdate && lastMessage) {
        clearLines(getLineCount(lastMessage))
      }
      outputInfo(message)
      lastMessage = message
    }
  }

  try {
    const bulkOperation = await startOperation()

    if (
      bulkOperation.organization.bulkData.operation.status === 'COMPLETED' ||
      bulkOperation.organization.bulkData.operation.status === 'FAILED'
    ) {
      await handleOperationCompletion(bulkOperation, getCompletionMessage)
      return bulkOperation
    }

    updateProgress(getInitialMessage())

    const operationId = bulkOperation.organization.bulkData.operation.id
    const completedOperation = await pollWithAnimation(pollOperation, operationId, renderProgress, updateProgress)
    await handleOperationCompletion(completedOperation, getCompletionMessage)
    return completedOperation
  } catch (error) {
    outputWarn(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}


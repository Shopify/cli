import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {outputInfo, outputCompleted, outputWarn} from '@shopify/cli-kit/node/output'
import {
  createRightAlignedText,
  createColoredProgressBar,
  createIndeterminateProgressBar,
} from '@shopify/cli-kit/node/ui'
import colors from '@shopify/cli-kit/node/colors'

const POLLING_INTERVAL_MS = 300
const CURSOR_UP_AND_CLEAR = '\x1b[1A\x1b[2K\r'

export interface BulkOperationProgressCallbacks {
  startOperation: () => Promise<unknown>
  pollOperation: (operationId: string) => Promise<unknown>
  onComplete?: (operation: unknown) => Promise<void>
}

interface RenderBulkOperationProgressOptions {
  type: 'export' | 'import' | 'copy'
  callbacks: BulkOperationProgressCallbacks
  storeName?: string
  sourceStoreName?: string
  targetStoreName?: string
}

interface StoreOperation {
  totalObjectCount?: number
  completedObjectCount?: number
  remoteOperationStatus?: string
}

function isOperationComplete(operation: StoreOperation): boolean {
  return operation.remoteOperationStatus === 'completed' || operation.remoteOperationStatus === 'failed'
}

function isBulkOperationComplete(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED'
}

interface BulkDataOperation {
  organization: {
    bulkData: {
      operation: {
        storeOperations: StoreOperation[]
      }
    }
  }
}

function extractStoreProgress(operation: unknown): {
  totalObjectCount: number
  completedObjectCount: number
} {
  const bulkOperation = operation as BulkDataOperation
  const storeOperations = bulkOperation.organization.bulkData.operation.storeOperations

  if (!storeOperations?.length) {
    return {totalObjectCount: 0, completedObjectCount: 0}
  }

  const [firstOp, secondOp] = storeOperations

  if (!firstOp) {
    return {totalObjectCount: 0, completedObjectCount: 0}
  }

  if (storeOperations.length === 1) {
    return {
      totalObjectCount: firstOp.totalObjectCount ?? 0,
      completedObjectCount: firstOp.completedObjectCount ?? 0,
    }
  }

  if (storeOperations.length === 2 && secondOp) {
    const activeOp = isOperationComplete(firstOp) ? secondOp : firstOp
    return {
      totalObjectCount: activeOp.totalObjectCount ?? 0,
      completedObjectCount: activeOp.completedObjectCount ?? 0,
    }
  }

  return {totalObjectCount: 0, completedObjectCount: 0}
}

function getStatusMessage(
  options: RenderBulkOperationProgressOptions,
  status: 'completed' | 'failed',
  completedCount: number,
) {
  const operationType = options.type.charAt(0).toUpperCase() + options.type.slice(1)

  if (status === 'completed') {
    return options.type === 'copy'
      ? `Copy completed successfully! Data copied from ${options.sourceStoreName} to ${options.targetStoreName}.`
      : `${operationType} completed successfully! ${completedCount} items processed.`
  } else {
    return `${operationType} operation failed.`
  }
}

function renderExportStep(_sourceStoreName: string, completedCount: number, dotCount = 3, animationFrame = 0): string {
  const progressBar = createIndeterminateProgressBar(animationFrame)
  const rightText = completedCount > 0 ? `${completedCount}${colors.dim(' items processed')}` : ''
  const dots = '.'.repeat(dotCount)
  const statusText = createRightAlignedText(`Exporting${dots}`, rightText)
  return `${progressBar}\n\n${statusText}`
}

function renderImportStep(_targetStoreName: string, completedCount: number, totalCount: number, dotCount = 3): string {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const progressBar = createColoredProgressBar(percentage)
  const rightText = totalCount > 0 ? `${completedCount}${colors.dim(` / ${totalCount}`)}` : ''
  const dots = '.'.repeat(dotCount)
  const statusText = createRightAlignedText(`Importing${dots}`, rightText)
  return `${progressBar}\n\n${statusText}`
}

function renderCopyProgress(
  options: RenderBulkOperationProgressOptions,
  storeOps: StoreOperation[],
  _progress: {totalObjectCount: number; completedObjectCount: number},
  updateStep: (step: string) => void,
  dotCount = 3,
  animationFrame = 0,
): string {
  if (storeOps.length === 1) {
    const exportOp = storeOps[0]
    updateStep('Step 1 of 2')
    const exportCount = exportOp?.completedObjectCount ?? 0
    return renderExportStep(options.sourceStoreName ?? '', exportCount, dotCount, animationFrame)
  }

  if (storeOps.length === 2) {
    const [exportOp, importOp] = storeOps

    if (exportOp && isOperationComplete(exportOp)) {
      updateStep('Step 2 of 2')
      return renderImportStep(
        options.targetStoreName ?? '',
        importOp?.completedObjectCount ?? 0,
        importOp?.totalObjectCount ?? 0,
        dotCount,
      )
    } else {
      updateStep('Step 1 of 2')
      const exportCount = exportOp?.completedObjectCount ?? 0
      return renderExportStep(options.sourceStoreName ?? '', exportCount, dotCount, animationFrame)
    }
  }

  return ''
}

async function handleOperationCompletion(
  operation: BulkDataOperationByIdResponse,
  options: RenderBulkOperationProgressOptions,
  progress: {totalObjectCount: number; completedObjectCount: number},
): Promise<void> {
  const status = operation.organization.bulkData.operation.status
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
    await options.callbacks.onComplete(operation)
  }
}

function renderProgressForType(
  options: RenderBulkOperationProgressOptions,
  operation: BulkDataOperationByIdResponse,
  progress: {totalObjectCount: number; completedObjectCount: number},
  updateStep: (step: string) => void,
  dotCount = 3,
  animationFrame = 0,
): string {
  if (options.type === 'copy') {
    const storeOps = operation.organization.bulkData.operation.storeOperations
    if (storeOps) {
      return renderCopyProgress(options, storeOps, progress, updateStep, dotCount, animationFrame)
    }
  } else if (options.type === 'export') {
    const storeOps = operation.organization.bulkData.operation.storeOperations
    const exportCount = storeOps?.[0]?.completedObjectCount ?? progress.completedObjectCount
    return renderExportStep(options.storeName ?? '', exportCount, dotCount, animationFrame)
  } else if (options.type === 'import') {
    return renderImportStep(options.storeName ?? '', progress.completedObjectCount, progress.totalObjectCount, dotCount)
  }
  return ''
}

async function pollUntilComplete(
  options: RenderBulkOperationProgressOptions,
  operationId: string,
  updateProgress: (message: string, isProgressUpdate?: boolean) => void,
  updateStep: (step: string) => void,
): Promise<BulkDataOperationByIdResponse> {
  let currentOperation: BulkDataOperationByIdResponse
  let lastStoreOpsCount = 0
  let animationCounter = 0
  let dotCounter = 0
  let isRunning = true
  let latestProgress: {totalObjectCount: number; completedObjectCount: number} | null = null
  let latestStatus: string | null = null

  const animationInterval = setInterval(() => {
    if (!isRunning || !latestStatus || latestStatus !== 'RUNNING' || !currentOperation || !latestProgress) return

    const dotCycle = dotCounter % 9
    let dotCount
    if (dotCycle < 2) dotCount = 0
    else if (dotCycle < 4) dotCount = 1
    else if (dotCycle < 6) dotCount = 2
    else dotCount = 3

    const progressDisplay = renderProgressForType(
      options,
      currentOperation,
      latestProgress,
      updateStep,
      dotCount,
      animationCounter,
    )
    if (progressDisplay) {
      updateProgress(progressDisplay, true)
    }
    animationCounter++
    if (animationCounter % 4 === 0) {
      dotCounter++
    }
  }, 80)

  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      currentOperation = (await options.callbacks.pollOperation(operationId)) as BulkDataOperationByIdResponse
      const progress = extractStoreProgress(currentOperation)
      const status = currentOperation.organization.bulkData.operation.status

      latestProgress = progress
      latestStatus = status

      if (isBulkOperationComplete(status)) {
        clearInterval(animationInterval)
        isRunning = false

        const finalDisplay = renderProgressForType(options, currentOperation, progress, updateStep, 3, animationCounter)
        if (finalDisplay) {
          updateProgress(`${finalDisplay}\n`, true)
        }

        // eslint-disable-next-line no-await-in-loop
        await handleOperationCompletion(currentOperation, options, progress)
        return currentOperation
      }

      if (status === 'RUNNING') {
        if (options.type === 'copy') {
          const storeOps = currentOperation.organization.bulkData.operation.storeOperations
          const currentStoreOpsCount = storeOps?.length ?? 0

          if (currentStoreOpsCount === 2 && lastStoreOpsCount === 1 && storeOps) {
            const [exportOp, importOp] = storeOps
            if (exportOp && isOperationComplete(exportOp)) {
              const finalExportCount = importOp?.totalObjectCount ?? exportOp?.completedObjectCount ?? 0
              if (finalExportCount > 0) {
                isRunning = false
                updateStep('Step 1 of 2')
                const finalExportDisplay = renderExportStep(
                  options.sourceStoreName ?? '',
                  finalExportCount,
                  3,
                  animationCounter,
                )
                updateProgress(finalExportDisplay, true)
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => setTimeout(resolve, 800))
                isRunning = true
              }
            }
          }
          lastStoreOpsCount = currentStoreOpsCount
        }
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS))
    }
  } finally {
    clearInterval(animationInterval)
  }
}

export async function renderBulkOperationProgress(
  options: RenderBulkOperationProgressOptions,
): Promise<BulkDataOperationByIdResponse> {
  let lastMessage = ''
  let currentStep = ''

  const updateProgress = (message: string, isProgressUpdate = false) => {
    if (isProgressUpdate || message !== lastMessage) {
      if (isProgressUpdate && lastMessage) {
        const lineCount = (lastMessage.match(/\n/g) ?? []).length + 1
        for (let i = 0; i < lineCount; i++) {
          process.stdout.write(CURSOR_UP_AND_CLEAR)
        }
      }
      outputInfo(message)
      lastMessage = message
    }
  }

  const updateStep = (step: string) => {
    if (step !== currentStep) {
      if (lastMessage) {
        const progressLineCount = (lastMessage.match(/\n/g) ?? []).length + 1
        for (let i = 0; i < progressLineCount; i++) {
          process.stdout.write(CURSOR_UP_AND_CLEAR)
        }
      }
      if (currentStep) {
        for (let i = 0; i < 2; i++) {
          process.stdout.write(CURSOR_UP_AND_CLEAR)
        }
      }
      outputInfo(`${colors.dim(step)}\n`)
      currentStep = step
      lastMessage = ''
    }
  }

  try {
    const operation = await options.callbacks.startOperation()
    const initialProgress = extractStoreProgress(operation)
    const bulkOperation = operation as BulkDataOperationByIdResponse

    if (isBulkOperationComplete(bulkOperation.organization.bulkData.operation.status)) {
      await handleOperationCompletion(bulkOperation, options, initialProgress)
      return bulkOperation
    }

    const getInitialMessage = () => {
      if (options.type === 'copy') {
        return `Starting copy operation from ${options.sourceStoreName} to ${options.targetStoreName}...`
      }
      const storeName = options.storeName
      const direction = options.type === 'export' ? 'from' : 'to'
      return `Starting ${options.type} operation${storeName ? ` ${direction} ${storeName}` : ''}...`
    }

    updateProgress(getInitialMessage())

    const operationId = (operation as BulkDataOperationByIdResponse).organization.bulkData.operation.id
    return await pollUntilComplete(options, operationId, updateProgress, updateStep)
  } catch (error) {
    outputWarn(`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

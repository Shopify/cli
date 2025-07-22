import {useState, useEffect, useRef} from 'react'

export interface BulkOperationProgressState {
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING' | 'CREATED'
  totalObjectCount: number
  completedObjectCount: number
  operation: any | null
  error?: Error
}

export interface BulkOperationProgressCallbacks {
  startOperation: () => Promise<any>
  pollOperation: (operationId: string) => Promise<any>
  onComplete?: (operation: any) => Promise<void>
}

interface BulkOperationProgressOptions {
  pollingInterval?: number
  extractProgress?: (operation: any) => {totalObjectCount: number, completedObjectCount: number}
}

export function useBulkOperationProgress(
  callbacks: BulkOperationProgressCallbacks,
  options: BulkOperationProgressOptions = {}
) {
  const {pollingInterval = 500, extractProgress = defaultExtractProgress} = options
  const [state, setState] = useState<BulkOperationProgressState>({
    status: 'PENDING',
    totalObjectCount: 0,
    completedObjectCount: 0,
    operation: null,
  })

  const intervalRef = useRef<NodeJS.Timeout>()
  const isStartedRef = useRef(false)

  const pollForUpdates = async (operationId: string) => {
    try {
      const operation = await callbacks.pollOperation(operationId)
      const progress = extractProgress(operation)
      const status = operation.organization.bulkData.operation.status

      setState({
        status,
        totalObjectCount: progress.totalObjectCount,
        completedObjectCount: progress.completedObjectCount,
        operation,
      })

      if (status === 'COMPLETED' || status === 'FAILED') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        if (callbacks.onComplete) {
          await callbacks.onComplete(operation)
        }
      }
    } catch (error) {
      setState((prev: BulkOperationProgressState) => ({
        ...prev,
        status: 'FAILED',
        error: error as Error,
      }))
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }

  const startOperation = async () => {
    if (isStartedRef.current) return

    isStartedRef.current = true
    
    try {
      const operation = await callbacks.startOperation()
      const progress = extractProgress(operation)
      const status = operation.organization.bulkData.operation.status

      setState({
        status,
        totalObjectCount: progress.totalObjectCount,
        completedObjectCount: progress.completedObjectCount,
        operation,
      })

      if (status === 'RUNNING' || status === 'CREATED') {
        const operationId = operation.organization.bulkData.operation.id
        intervalRef.current = setInterval(() => pollForUpdates(operationId), pollingInterval)
      } else if (status === 'COMPLETED' || status === 'FAILED') {
        if (callbacks.onComplete) {
          await callbacks.onComplete(operation)
        }
      }
    } catch (error) {
      setState((prev: BulkOperationProgressState) => ({
        ...prev,
        status: 'FAILED',
        error: error as Error,
      }))
    }
  }

  useEffect(() => {
    startOperation()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return state
}

function defaultExtractProgress(operation: any): {totalObjectCount: number, completedObjectCount: number} {
  const storeOperations = operation?.organization?.bulkData?.operation?.storeOperations

  if (!storeOperations || storeOperations.length === 0) {
    return {totalObjectCount: 0, completedObjectCount: 0}
  }

  if (storeOperations.length === 1) {
    return {
      totalObjectCount: storeOperations[0]?.totalObjectCount || 0,
      completedObjectCount: storeOperations[0]?.completedObjectCount || 0
    }
  }

  if (storeOperations.length === 2) {
    const firstOp = storeOperations[0]
    const firstOpStatus = firstOp?.remoteOperationStatus

    if (firstOpStatus === 'completed' || firstOpStatus === 'failed') {
      return {
        totalObjectCount: storeOperations[1]?.totalObjectCount || 0,
        completedObjectCount: storeOperations[1]?.completedObjectCount || 0
      }
    } else {
      return {
        totalObjectCount: firstOp?.totalObjectCount || 0,
        completedObjectCount: firstOp?.completedObjectCount || 0
      }
    }
  }

  return {totalObjectCount: 0, completedObjectCount: 0}
}
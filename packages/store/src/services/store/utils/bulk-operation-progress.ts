import {renderBulkOperationProgress as renderProgress, BulkOperationProgressCallbacks} from '@shopify/cli-kit/node/ui'
import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'

interface RenderBulkOperationProgressOptions {
  type: 'export' | 'import'
  callbacks: BulkOperationProgressCallbacks
  storeName?: string
}

function extractStoreProgress(operation: BulkDataOperationByIdResponse): {totalObjectCount: number, completedObjectCount: number} {
  const storeOperations = operation.organization.bulkData.operation.storeOperations

  if (!storeOperations || storeOperations.length === 0) {
    return {totalObjectCount: 0, completedObjectCount: 0}
  }

  if (storeOperations.length === 1) {
    return {
      totalObjectCount: storeOperations[0]!.totalObjectCount,
      completedObjectCount: storeOperations[0]!.completedObjectCount
    }
  }

  if (storeOperations.length === 2) {
    const firstOp = storeOperations[0]
    const firstOpStatus = firstOp!.remoteOperationStatus

    if (firstOpStatus === 'completed' || firstOpStatus === 'failed') {
      return {
        totalObjectCount: storeOperations[1]!.totalObjectCount,
        completedObjectCount: storeOperations[1]!.completedObjectCount
      }
    } else {
      return {
        totalObjectCount: firstOp!.totalObjectCount,
        completedObjectCount: firstOp!.completedObjectCount
      }
    }
  }

  return {totalObjectCount: 0, completedObjectCount: 0}
}

export async function renderBulkOperationProgress({
  type,
  callbacks,
  storeName,
}: RenderBulkOperationProgressOptions): Promise<BulkDataOperationByIdResponse> {
  return renderProgress({
    type,
    callbacks,
    storeName,
    extractProgress: extractStoreProgress,
  }) as Promise<BulkDataOperationByIdResponse>
}
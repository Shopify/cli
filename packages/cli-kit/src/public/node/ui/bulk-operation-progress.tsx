import React from 'react'
import {render} from '../ui.js'
import {BulkOperationProgress} from '../../../private/node/ui/components/BulkOperationProgress.js'

export interface BulkOperationProgressCallbacks {
  startOperation: () => Promise<any>
  pollOperation: (operationId: string) => Promise<any>
  onComplete?: (operation: any) => Promise<void>
}

interface RenderBulkOperationProgressOptions {
  type: 'export' | 'import'
  callbacks: BulkOperationProgressCallbacks
  storeName?: string
  extractProgress?: (operation: any) => {totalObjectCount: number, completedObjectCount: number}
}

export async function renderBulkOperationProgress({
  type,
  callbacks,
  storeName,
  extractProgress,
}: RenderBulkOperationProgressOptions): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const enhancedCallbacks = {
      ...callbacks,
      onComplete: async (operation: any) => {
        if (callbacks.onComplete) {
          await callbacks.onComplete(operation)
        }
        resolve(operation)
      },
    }

    render(
      <BulkOperationProgress
        callbacks={enhancedCallbacks}
        storeName={storeName}
        operationType={type}
        extractProgress={extractProgress}
      />,
      {
        exitOnCtrlC: false,
      }
    ).catch(reject)
  })
}
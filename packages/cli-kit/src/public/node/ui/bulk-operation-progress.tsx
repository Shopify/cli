import React from 'react'
import {render} from '../ui.js'
import {BulkOperationProgress} from '../../../private/node/ui/components/BulkOperationProgress.js'
import {CopyOperationProgress} from '../../../private/node/ui/components/CopyOperationProgress.js'

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

interface RenderCopyOperationProgressOptions {
  type: 'copy'
  callbacks: BulkOperationProgressCallbacks
  sourceStoreName: string
  targetStoreName: string
  extractProgress?: (operation: any) => {totalObjectCount: number, completedObjectCount: number}
}

export async function renderBulkOperationProgress(
  options: RenderBulkOperationProgressOptions | RenderCopyOperationProgressOptions
): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const enhancedCallbacks = {
      ...options.callbacks,
      onComplete: async (operation: any) => {
        if (options.callbacks.onComplete) {
          await options.callbacks.onComplete(operation)
        }
        resolve(operation)
      },
    }

    if (options.type === 'copy') {
      render(
        <CopyOperationProgress
          callbacks={enhancedCallbacks}
          sourceStoreName={options.sourceStoreName}
          targetStoreName={options.targetStoreName}
          extractProgress={options.extractProgress}
        />,
        {
          exitOnCtrlC: false,
        }
      ).catch(reject)
    } else {
      render(
        <BulkOperationProgress
          callbacks={enhancedCallbacks}
          storeName={options.storeName}
          operationType={options.type}
          extractProgress={options.extractProgress}
        />,
        {
          exitOnCtrlC: false,
        }
      ).catch(reject)
    }
  })
}
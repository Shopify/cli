import React from 'react'
import {Box, Text} from 'ink'
import {BulkOperationProgressCallbacks, useBulkOperationProgress} from '../hooks/bulk-operation-progress.js'

export interface CopyOperationProgressProps {
  callbacks: BulkOperationProgressCallbacks
  sourceStoreName: string
  targetStoreName: string
  extractProgress?: (operation: any) => {totalObjectCount: number, completedObjectCount: number}
}

export function CopyOperationProgress({
  callbacks, 
  sourceStoreName, 
  targetStoreName,
  extractProgress
}: CopyOperationProgressProps) {
  const state = useBulkOperationProgress(callbacks, {extractProgress})

  const getCurrentPhase = () => {
    // Determine which phase we're in based on the store operations
    if (!state.operation?.organization?.bulkData?.operation?.storeOperations) {
      return 'starting'
    }

    const storeOps = state.operation.organization.bulkData.operation.storeOperations
    
    if (storeOps.length === 1) {
      // Only export operation exists, we're in export phase
      return 'export'
    } else if (storeOps.length === 2) {
      const [exportOp, importOp] = storeOps
      
      if (exportOp?.remoteOperationStatus === 'completed' && importOp?.remoteOperationStatus !== 'completed') {
        // Export done, import in progress
        return 'import'
      } else if (exportOp?.remoteOperationStatus !== 'completed') {
        // Export still in progress
        return 'export'
      } else {
        // Both completed
        return 'completed'
      }
    }
    
    return 'starting'
  }

  const getStatusMessage = () => {
    const phase = getCurrentPhase()
    
    switch (state.status) {
      case 'PENDING':
        return `Starting copy operation...`
      case 'CREATED':
        return `Copy operation created, starting...`
      case 'RUNNING':
        if (state.totalObjectCount > 0) {
          if (phase === 'export') {
            // Use export-style display: single count
            return `Exporting from ${sourceStoreName}: ${state.completedObjectCount} objects exported`
          } else if (phase === 'import') {
            // Use import-style display: progress percentage
            const percentage = Math.round((state.completedObjectCount / state.totalObjectCount) * 100)
            return `Importing to ${targetStoreName}: ${state.completedObjectCount}/${state.totalObjectCount} (${percentage}%)`
          }
        }
        
        if (phase === 'export') {
          return `Exporting from ${sourceStoreName}...`
        } else if (phase === 'import') {
          return `Importing to ${targetStoreName}...`
        }
        return `Copying from ${sourceStoreName} to ${targetStoreName}...`
      case 'COMPLETED':
        return `Copy completed successfully! Data copied from ${sourceStoreName} to ${targetStoreName}.`
      case 'FAILED':
        return `Copy failed${state.error ? `: ${state.error.message}` : ''}`
      default:
        return `Copy in progress...`
    }
  }

  const getStatusColor = () => {
    switch (state.status) {
      case 'COMPLETED':
        return 'green'
      case 'FAILED':
        return 'red'
      case 'RUNNING':
      case 'CREATED':
        return 'blue'
      default:
        return 'white'
    }
  }

  const showProgressBar = () => {
    // Only show progress bar during import phase
    const phase = getCurrentPhase()
    return (state.status === 'RUNNING' || state.status === 'CREATED') && 
           state.totalObjectCount > 0 && 
           phase === 'import'
  }

  return (
    <Box flexDirection="column">
      <Text color={getStatusColor()}>
        {getStatusMessage()}
      </Text>
      {showProgressBar() && (
        <Box marginTop={1}>
          <Text dimColor>
            Progress: {((state.completedObjectCount / state.totalObjectCount) * 100).toFixed(1)}%
          </Text>
        </Box>
      )}
    </Box>
  )
}
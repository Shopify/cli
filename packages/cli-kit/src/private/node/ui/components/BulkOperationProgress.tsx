import React from 'react'
import {Box, Text} from 'ink'
import {BulkOperationProgressCallbacks, useBulkOperationProgress} from '../hooks/bulk-operation-progress.js'

export interface BulkOperationProgressProps {
  callbacks: BulkOperationProgressCallbacks
  storeName?: string
  operationType: 'export' | 'import'
  extractProgress?: (operation: any) => {totalObjectCount: number, completedObjectCount: number}
}

export function BulkOperationProgress({
  callbacks, 
  storeName, 
  operationType,
  extractProgress
}: BulkOperationProgressProps) {
  const state = useBulkOperationProgress(callbacks, {extractProgress})

  const getStatusMessage = () => {
    const verb = operationType === 'export' ? 'Exporting' : 'Importing'
    const preposition = operationType === 'export' ? 'from' : 'to'
    const pastTense = operationType === 'export' ? 'exported' : 'imported'

    switch (state.status) {
      case 'PENDING':
        return `Starting ${operationType} operation...`
      case 'CREATED':
        return `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} operation created, starting...`
      case 'RUNNING':
        if (state.totalObjectCount > 0) {
          if (operationType === 'export') {
            // For exports, show single count since completed === total
            return `${verb}${storeName ? ` ${preposition} ${storeName}` : ''}: ${state.completedObjectCount} objects exported`
          } else {
            // For imports, show progress as completed/total (percentage)
            const percentage = Math.round((state.completedObjectCount / state.totalObjectCount) * 100)
            return `${verb}${storeName ? ` ${preposition} ${storeName}` : ''}: ${state.completedObjectCount}/${state.totalObjectCount} (${percentage}%)`
          }
        }
        return `${verb}${storeName ? ` ${preposition} ${storeName}` : ''}...`
      case 'COMPLETED':
        return `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} completed successfully! ${state.completedObjectCount} items ${pastTense}.`
      case 'FAILED':
        return `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} failed${state.error ? `: ${state.error.message}` : ''}`
      default:
        return `${operationType.charAt(0).toUpperCase() + operationType.slice(1)} in progress...`
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

  return (
    <Box flexDirection="column">
      <Text color={getStatusColor()}>
        {getStatusMessage()}
      </Text>
      {(state.status === 'RUNNING' || state.status === 'CREATED') && state.totalObjectCount > 0 && operationType === 'import' && (
        <Box marginTop={1}>
          <Text dimColor>
            Progress: {((state.completedObjectCount / state.totalObjectCount) * 100).toFixed(1)}%
          </Text>
        </Box>
      )}
    </Box>
  )
}
import {executeBulkOperationJsonOutputSchema, type ExecuteBulkOperationResult} from './types.js'
import {bulkOperationJsonContext, toBulkOperationJson} from './json.js'
import {
  formatBulkOperationStatus,
  resultsContainUserErrors,
  extractBulkOperationId,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderSuccess, renderInfo, renderError, renderWarning, type TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {resolvePath} from '@shopify/cli-kit/node/path'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

export async function renderExecuteBulkOperationResult(
  result: ExecuteBulkOperationResult,
  options: {format: 'text' | 'json'; watch: boolean; outputFile?: string},
): Promise<void> {
  const {format, watch, outputFile} = options
  const {operation, userErrors, watchAborted, results} = result
  if (!operation && userErrors.length === 0) {
    renderWarning({
      headline: 'Bulk operation not created successfully.',
      body: 'This is an unexpected error. Please try again later.',
    })
    throw new BugError('Bulk operation response returned null with no error message.')
  }

  if (format === 'json') {
    if (userErrors.length || (operation && ['FAILED', 'CANCELED', 'EXPIRED'].includes(operation.status))) {
      const error = new AbortError('Bulk operation failed.')
      error.details = {
        ...bulkOperationJsonContext(result),
        operation: operation ? toBulkOperationJson(operation) : null,
        userErrors,
      }
      throw error
    }
    if (!operation) throw new BugError('Bulk operation response returned no operation.')

    const partial = results !== undefined && resultsContainUserErrors(results)
    let status: 'success' | 'partial' | 'cancelled' = partial ? 'partial' : 'success'
    if (watchAborted) status = 'cancelled'
    if (partial) process.exitCode = 1
    if (outputFile && results === undefined && !watchAborted) {
      throw new AbortError('No results are available to write to the output file.')
    }
    if (outputFile && results !== undefined) {
      const path = resolvePath(outputFile)
      await writeFile(path, results)
      outputResult(executeBulkOperationJsonOutputSchema.encode({path, format: 'jsonl'}))
    } else {
      outputResult(
        executeBulkOperationJsonOutputSchema.encode({
          ...bulkOperationJsonContext(result),
          status,
          ...(watchAborted ? {reason: 'watch-aborted' as const} : {}),
          operation: toBulkOperationJson(operation),
          ...(results === undefined ? {} : {resultsJsonl: results}),
        }),
      )
    }
    return
  }

  if (outputFile && results !== undefined) await writeFile(outputFile, results)

  if (userErrors.length) {
    renderError({
      headline: 'Error creating bulk operation.',
      body: {
        list: {
          items: userErrors.map((error) =>
            error.field ? `${error.field.join('.')}: ${error.message}` : error.message,
          ),
        },
      },
    })
    return
  }
  if (!operation) return

  if (watchAborted) {
    renderInfo({
      headline: `Bulk operation ${operation.id} is still running in the background.`,
      body: statusCommandHelpMessage(operation.id),
    })
  } else if (watch || ['FAILED', 'CANCELED', 'EXPIRED'].includes(operation.status)) {
    renderBulkOperationResult(operation, results, outputFile)
  } else {
    renderSuccess({
      headline: 'Bulk operation is running.',
      body: statusCommandHelpMessage(operation.id),
      customSections: [{body: [{list: {items: [outputContent`ID: ${outputToken.cyan(operation.id)}`.value]}}]}],
    })
  }
}

function renderBulkOperationResult(operation: BulkOperation, results?: string, outputFile?: string): void {
  const headline = formatBulkOperationStatus(operation).value
  const items = [
    outputContent`ID: ${outputToken.cyan(operation.id)}`.value,
    outputContent`Status: ${outputToken.yellow(operation.status)}`.value,
    outputContent`Created at: ${outputToken.gray(String(operation.createdAt))}`.value,
    ...(operation.completedAt
      ? [outputContent`Completed at: ${outputToken.gray(String(operation.completedAt))}`.value]
      : []),
  ]

  const customSections = [{body: [{list: {items}}]}]

  switch (operation.status) {
    case 'CREATED':
      renderSuccess({
        headline: 'Bulk operation started.',
        body: statusCommandHelpMessage(operation.id),
        customSections,
      })
      break
    case 'RUNNING':
      renderSuccess({
        headline: 'Bulk operation is running.',
        body: statusCommandHelpMessage(operation.id),
        customSections,
      })
      break
    case 'COMPLETED':
      if (results === undefined) {
        renderSuccess({headline, customSections})
      } else {
        const hasUserErrors = resultsContainUserErrors(results)

        if (!outputFile) outputResult(results)

        if (hasUserErrors) {
          renderWarning({
            headline: 'Bulk operation completed with errors.',
            body: outputFile
              ? `Results written to ${outputFile}. Check file for error details.`
              : 'Check results for error details.',
            customSections,
          })
        } else {
          renderSuccess({
            headline,
            body: outputFile ? [`Results written to ${outputFile}`] : undefined,
            customSections,
          })
        }
      }
      break
    case 'CANCELED':
    case 'CANCELING':
    case 'EXPIRED':
    case 'FAILED':
      renderError({headline, customSections})
      break
  }
}

function statusCommandHelpMessage(operationId: string): TokenItem {
  return [
    'Monitor its progress with:\n',
    {command: `shopify store bulk status --id=${extractBulkOperationId(operationId)}`},
  ]
}

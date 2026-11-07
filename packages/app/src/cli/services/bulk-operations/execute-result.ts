import {executeBulkOperationJsonOutputSchema, type ExecuteBulkOperationResult} from './types.js'
import {bulkOperationJsonContext, toBulkOperationJson} from './json.js'
import {resultsContainMutationErrors} from './mutation-errors.js'
import {
  formatBulkOperationStatus,
  resultsContainUserErrors,
  extractBulkOperationId,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderSuccess, renderInfo, renderError, renderWarning, type TokenItem} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputResult, outputWarn} from '@shopify/cli-kit/node/output'
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
    const warning = {
      headline: 'Bulk operation not created successfully.',
      body: 'This is an unexpected error. Please try again later.',
    }
    if (format === 'json') outputWarn(`${warning.headline} ${warning.body}`)
    else renderWarning(warning)
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

    const partial =
      operation.type === 'MUTATION' && results !== undefined && resultsContainMutationErrors(results, result.query)
    let status: 'success' | 'partial' | 'cancelled' = partial ? 'partial' : 'success'
    if (watchAborted) status = 'cancelled'
    if (partial) process.exitCode = 1
    const hasEmptyQueryResult =
      watch &&
      !watchAborted &&
      operation.type === 'QUERY' &&
      operation.status === 'COMPLETED' &&
      String(operation.objectCount) === '0' &&
      !operation.url
    const fileResults = results ?? (hasEmptyQueryResult ? '' : undefined)
    if (outputFile && fileResults === undefined && !watchAborted) {
      throw new AbortError('No results are available to write to the output file.')
    }
    if (outputFile && fileResults !== undefined) {
      const path = resolvePath(outputFile)
      await writeFile(path, fileResults)
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
    await renderBulkOperationResult(operation, results, outputFile)
  } else {
    renderSuccess({
      headline: 'Bulk operation is running.',
      body: statusCommandHelpMessage(operation.id),
      customSections: [{body: [{list: {items: [outputContent`ID: ${outputToken.cyan(operation.id)}`.value]}}]}],
    })
  }
}

async function renderBulkOperationResult(
  operation: BulkOperation,
  results?: string,
  outputFile?: string,
): Promise<void> {
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

        if (outputFile) await writeFile(outputFile, results)
        else outputResult(results)

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
    {command: `shopify app bulk status --id=${extractBulkOperationId(operationId)}`},
  ]
}

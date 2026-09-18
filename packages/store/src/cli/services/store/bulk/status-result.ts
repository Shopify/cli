import {bulkOperationStatusJsonOutputSchema, type BulkOperationStatusResult} from './types.js'
import {
  formatBulkOperationStatus,
  extractBulkOperationId,
  type BulkOperation,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderSuccess, renderError, renderTable} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputNewline, outputResult} from '@shopify/cli-kit/node/output'
import {timeAgo, formatDate} from '@shopify/cli-kit/common/string'
import colors from '@shopify/cli-kit/node/colors'

export function renderBulkOperationStatusResult(result: BulkOperationStatusResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(bulkOperationStatusJsonOutputSchema.encode(result))
    return
  }
  if ('operation' in result) {
    if (result.operation) {
      renderBulkOperationStatus(result.operation)
    } else {
      renderError({
        headline: 'Bulk operation not found.',
        body: outputContent`ID: ${outputToken.yellow(result.operationId)}`.value,
      })
    }
    return
  }

  const operations = result.operations.map((operation) => ({
    id: extractBulkOperationId(operation.id),
    status: formatStatus(operation.status),
    count: formatCount(operation.objectCount as number),
    dateCreated: formatDate(new Date(String(operation.createdAt))),
    dateFinished: operation.completedAt ? formatDate(new Date(String(operation.completedAt))) : '',
    results: downloadLink(operation.url ?? operation.partialDataUrl),
  }))

  outputNewline()

  if (operations.length === 0) {
    renderInfo({body: 'No bulk operations found in the last 7 days.'})
  } else {
    renderTable({
      rows: operations,
      columns: {
        id: {header: 'ID', color: 'yellow'},
        status: {header: 'STATUS'},
        count: {header: 'COUNT'},
        dateCreated: {header: 'DATE CREATED', color: 'cyan'},
        dateFinished: {header: 'DATE FINISHED', color: 'cyan'},
        results: {header: 'RESULTS'},
      },
    })
  }

  outputNewline()
}

function renderBulkOperationStatus(operation: BulkOperation): void {
  const {id, status, createdAt, completedAt, url, partialDataUrl} = operation
  const statusDescription = formatBulkOperationStatus(operation).value
  const timeDifference = formatTimeDifference(createdAt, completedAt)
  const operationInfo = outputContent`ID: ${outputToken.yellow(id)}\n${timeDifference}`.value

  if (status === 'COMPLETED') {
    const downloadLink = url ? outputToken.link('Download results', url) : ''
    renderSuccess({headline: statusDescription, body: outputContent`${operationInfo}\n${downloadLink}`.value})
  } else if (status === 'FAILED') {
    const downloadLink = partialDataUrl ? outputToken.link('Download partial results', partialDataUrl) : ''
    renderError({headline: statusDescription, body: outputContent`${operationInfo}\n${downloadLink}`.value})
  } else {
    renderInfo({headline: statusDescription, body: operationInfo})
  }
}

function formatTimeDifference(createdAt: unknown, completedAt?: unknown): string {
  const now = new Date()

  if (completedAt) {
    return `Finished ${timeAgo(new Date(String(completedAt)), now)}`
  } else {
    return `Started ${timeAgo(new Date(String(createdAt)), now)}`
  }
}

function formatStatus(status: string): string {
  if (status === 'COMPLETED') return colors.green(status)
  if (status === 'FAILED') return colors.red(status)
  return colors.dim(status)
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function downloadLink(downloadUrl: string | null | undefined): string {
  return downloadUrl ? outputContent`${outputToken.link('download', downloadUrl)}`.value : ''
}

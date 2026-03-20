import {BulkOperation} from './bulk-operations/watch-bulk-operation.js'
import {formatBulkOperationStatus} from './bulk-operations/format-bulk-operation-status.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './bulk-operations/constants.js'
import {extractBulkOperationId} from './bulk-operations/bulk-operation-status.js'
import {
  GetBulkOperationById,
  GetBulkOperationByIdQuery,
} from '../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {formatStoreOperationInfo, resolveApiVersion} from './graphql/common.js'
import {
  ListBulkOperations,
  ListBulkOperationsQuery,
  ListBulkOperationsQueryVariables,
} from '../api/graphql/bulk-operations/generated/list-bulk-operations.js'
import {renderInfo, renderSuccess, renderError, renderTable} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputNewline} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {timeAgo, formatDate} from '@shopify/cli-kit/common/string'
import colors from '@shopify/cli-kit/node/colors'

interface StoreGetBulkOperationStatusOptions {
  storeFqdn: string
  operationId: string
}

interface StoreListBulkOperationsOptions {
  storeFqdn: string
}

export async function storeGetBulkOperationStatus(options: StoreGetBulkOperationStatusOptions): Promise<void> {
  const {storeFqdn, operationId} = options

  renderInfo({
    headline: 'Checking bulk operation status.',
    body: [
      {
        list: {
          items: formatStoreOperationInfo({storeFqdn}),
        },
      },
    ],
  })

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const response = await adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
    query: GetBulkOperationById,
    session: adminSession,
    variables: {id: operationId},
    version: await resolveApiVersion({
      adminSession,
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    }),
  })

  if (response.bulkOperation) {
    renderBulkOperationStatus(response.bulkOperation)
  } else {
    renderError({
      headline: 'Bulk operation not found.',
      body: outputContent`ID: ${outputToken.yellow(operationId)}`.value,
    })
  }
}

export async function storeListBulkOperations(options: StoreListBulkOperationsOptions): Promise<void> {
  const {storeFqdn} = options

  renderInfo({
    headline: 'Listing bulk operations.',
    body: [
      {
        list: {
          items: formatStoreOperationInfo({storeFqdn}),
        },
      },
    ],
  })

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const response = await adminRequestDoc<ListBulkOperationsQuery, ListBulkOperationsQueryVariables>({
    query: ListBulkOperations,
    session: adminSession,
    variables: {
      query: `created_at:>=${sevenDaysAgo}`,
      first: 100,
      sortKey: 'CREATED_AT',
    },
    version: await resolveApiVersion({
      adminSession,
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    }),
  })

  const operations = response.bulkOperations.nodes.map((operation) => ({
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

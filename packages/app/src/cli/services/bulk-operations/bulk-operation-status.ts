import {BulkOperation} from './watch-bulk-operation.js'
import {formatBulkOperationStatus} from './format-bulk-operation-status.js'
import {
  GetBulkOperationById,
  GetBulkOperationByIdQuery,
} from '../../api/graphql/bulk-operations/generated/get-bulk-operation-by-id.js'
import {OrganizationApp} from '../../models/organization.js'
import {
  ListBulkOperations,
  ListBulkOperationsQuery,
} from '../../api/graphql/bulk-operations/generated/list-bulk-operations.js'
import {renderInfo, renderSuccess, renderError, renderTable} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {timeAgo, formatDate} from '@shopify/cli-kit/common/string'
import {BugError} from '@shopify/cli-kit/node/error'

const API_VERSION = '2026-01'

interface GetBulkOperationStatusOptions {
  storeFqdn: string
  operationId: string
  remoteApp: OrganizationApp
}

export async function getBulkOperationStatus(options: GetBulkOperationStatusOptions): Promise<void> {
  const {storeFqdn, operationId, remoteApp} = options

  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)

  const response = await adminRequestDoc<GetBulkOperationByIdQuery, {id: string}>({
    query: GetBulkOperationById,
    session: adminSession,
    variables: {id: operationId},
    version: API_VERSION,
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

interface ListBulkOperationsOptions {
  storeFqdn: string
  remoteApp: OrganizationApp
}

export async function listBulkOperations(options: ListBulkOperationsOptions): Promise<void> {
  const {storeFqdn, remoteApp} = options

  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const dateFilter = sevenDaysAgo.toISOString().split('T')[0]

  const response = await adminRequestDoc<ListBulkOperationsQuery, {query?: string}>({
    query: ListBulkOperations,
    session: adminSession,
    variables: {query: `created_at:>=${dateFilter}`},
    version: API_VERSION,
  })

  const operations = response.bulkOperations.nodes.map((op) => ({
    id: op.id,
    status: op.status,
    count: formatCount(op.objectCount),
    dateCreated: formatDate(new Date(String(op.createdAt))),
    dateFinished: op.completedAt ? formatDate(new Date(String(op.completedAt))) : '',
    results: formatResults(op.url, op.partialDataUrl),
  }))

  renderTable({
    rows: operations,
    columns: {
      id: {header: 'ID'},
      status: {header: 'STATUS'},
      count: {header: 'COUNT'},
      dateCreated: {header: 'DATE CREATED'},
      dateFinished: {header: 'DATE FINISHED'},
      results: {header: 'RESULTS'},
    },
  })
}

function formatCount(count: unknown): string {
  const num = Number(count)
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return String(num)
}

function formatResults(url: string | null | undefined, partialDataUrl: string | null | undefined): string {
  const downloadUrl = url ?? partialDataUrl
  return downloadUrl ? 'download' : ''
}

import {formatOperationInfo, resolveApiVersion} from '../graphql/common.js'
import {OrganizationApp, Organization} from '../../models/organization.js'
import {
  BULK_OPERATIONS_MIN_API_VERSION,
  fetchBulkOperationById,
  fetchRecentBulkOperations,
  formatBulkOperationStatus,
  extractBulkOperationId,
  type BulkOperation,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {renderInfo, renderSuccess, renderError, renderTable} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken, outputNewline} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {timeAgo, formatDate} from '@shopify/cli-kit/common/string'
import {BugError} from '@shopify/cli-kit/node/error'
import colors from '@shopify/cli-kit/node/colors'

interface GetBulkOperationStatusOptions {
  organization: Organization
  storeFqdn: string
  operationId: string
  remoteApp: OrganizationApp
}

interface ListBulkOperationsOptions {
  organization: Organization
  storeFqdn: string
  remoteApp: OrganizationApp
}

export async function getBulkOperationStatus(options: GetBulkOperationStatusOptions): Promise<void> {
  const {organization, storeFqdn, operationId, remoteApp} = options

  renderInfo({
    headline: 'Checking bulk operation status.',
    body: [
      {
        list: {
          items: formatOperationInfo({organization, remoteApp, storeFqdn}),
        },
      },
    ],
  })

  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)

  const operation = await fetchBulkOperationById({
    adminSession,
    operationId,
    version: await resolveApiVersion({
      adminSession,
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    }),
  })

  if (operation) {
    renderBulkOperationStatus(operation)
  } else {
    renderError({
      headline: 'Bulk operation not found.',
      body: outputContent`ID: ${outputToken.yellow(operationId)}`.value,
    })
  }
}

export async function listBulkOperations(options: ListBulkOperationsOptions): Promise<void> {
  const {organization, storeFqdn, remoteApp} = options

  renderInfo({
    headline: 'Listing bulk operations.',
    body: [
      {
        list: {
          items: formatOperationInfo({organization, remoteApp, storeFqdn}),
        },
      },
    ],
  })

  const appSecret = remoteApp.apiSecretKeys[0]?.secret
  if (!appSecret) throw new BugError('No API secret keys found for app')

  const adminSession = await ensureAuthenticatedAdminAsApp(storeFqdn, remoteApp.apiKey, appSecret)

  const nodes = await fetchRecentBulkOperations({
    adminSession,
    version: await resolveApiVersion({
      adminSession,
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    }),
  })

  const operations = nodes.map((operation) => ({
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

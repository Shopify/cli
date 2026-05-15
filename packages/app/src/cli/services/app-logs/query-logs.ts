import {
  AppLogsQuery,
  AppLogsQueryResult,
  AppLogsQueryVariables,
  AppLogNode,
} from '../../api/graphql/app-management/generated/app-logs-query.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {OrganizationApp, Organization} from '../../models/organization.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {outputInfo, outputSuccess, outputWarn} from '@shopify/cli-kit/node/output'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'

interface QueryLogsOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  organization: Organization
  developerPlatformClient: DeveloperPlatformClient
  types?: string[]
  status?: string
  target?: string
  last: string
  first: number
  after?: string
  json?: boolean
}

interface QueryLogsDirectOptions {
  apiKey: string
  types?: string[]
  status?: string
  target?: string
  last: string
  first: number
  after?: string
  json?: boolean
}

export async function queryLogsDirect(options: QueryLogsDirectOptions): Promise<void> {
  const {startTime, endTime} = parseTimeRange(options.last)

  const variables: AppLogsQueryVariables = {
    apiKey: options.apiKey,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    types: options.types,
    status: options.status,
    target: options.target,
    first: options.first,
    after: options.after,
  }

  outputInfo(`Querying logs for app key: ${options.apiKey}`)
  outputInfo(`Time range: ${startTime.toISOString()} → ${endTime.toISOString()}`)
  if (options.types) outputInfo(`Types: ${options.types.join(', ')}`)
  if (options.status) outputInfo(`Status: ${options.status}`)
  if (options.target) outputInfo(`Target: ${options.target}`)
  outputInfo('')

  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform()
  const result: AppLogsQueryResult = await appManagementRequestDoc({
    token: appManagementToken,
    query: AppLogsQuery,
    variables,
    unauthorizedHandler: {type: 'token_refresh', handler: async () => ({token: undefined})},
  })

  renderResults(result, options.json)
}

export async function queryLogs(options: QueryLogsOptions): Promise<void> {
  const {remoteApp, developerPlatformClient, organization} = options

  const {startTime, endTime} = parseTimeRange(options.last)

  const variables: AppLogsQueryVariables = {
    apiKey: remoteApp.apiKey,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    types: options.types,
    status: options.status,
    target: options.target,
    first: options.first,
    after: options.after,
  }

  outputInfo(`Querying logs for app "${remoteApp.title}" (${remoteApp.apiKey})...`)
  outputInfo(`Time range: ${startTime.toISOString()} → ${endTime.toISOString()}`)

  if (options.types) {
    outputInfo(`Types: ${options.types.join(', ')}`)
  }
  if (options.status) {
    outputInfo(`Status: ${options.status}`)
  }
  if (options.target) {
    outputInfo(`Target: ${options.target}`)
  }

  outputInfo('')

  // The appLogsQuery method is added to the app-management client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = developerPlatformClient as any
  const result: AppLogsQueryResult = await client.appManagementRequest({
    query: AppLogsQuery,
    variables,
  })

  renderResults(result, options.json)
}

function renderResults(result: AppLogsQueryResult, json?: boolean): void {
  const {edges, pageInfo} = result.appLogs

  if (edges.length === 0) {
    outputWarn('No logs found for the given filters and time range.')
    return
  }

  if (json) {
    const output = {
      logs: edges.map((edge) => edge.node),
      pageInfo,
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2))
  } else {
    renderLogsText(edges.map((edge) => edge.node))

    outputInfo('')
    outputSuccess(`${edges.length} log(s) returned.`)

    if (pageInfo.hasNextPage && pageInfo.endCursor) {
      outputInfo(`\nMore results available. Use --after="${pageInfo.endCursor}" to get the next page.`)
    }
  }
}

function renderLogsText(logs: AppLogNode[]): void {
  for (const log of logs) {
    const time = formatTimestamp(log.timestamp)
    const type = formatType(log.type)
    const status = formatStatus(log.status)
    const target = log.target || '-'
    const shop = log.shopDomain ? shortenDomain(log.shopDomain) : '-'
    const duration = log.executionDurationMs != null ? `${log.executionDurationMs}ms` : '-'

    outputInfo(`${time}  ${type.padEnd(10)} ${status} ${target.padEnd(20)} ${shop.padEnd(25)} ${duration}`)
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})
}

function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    WEBHOOK_DELIVERY: 'webhook',
    FUNCTION_RUN: 'function',
    GRAPHQL_REQUEST: 'graphql',
    REST_REQUEST: 'rest',
    APP_EVENT: 'app_event',
    APP_BILLING_EVENT: 'billing',
  }
  return typeMap[type] || type
}

function formatStatus(status: string | null): string {
  if (!status) return '-'
  if (status.includes('SUCCESS')) return '✓'
  if (status.includes('FAILURE')) return '✗'
  return status
}

function shortenDomain(domain: string): string {
  return domain.replace('.myshopify.com', '')
}

function parseTimeRange(last: string): {startTime: Date; endTime: Date} {
  const endTime = new Date()
  const match = last.match(/^(\d+)(m|h|d)$/)

  if (!match) {
    return {startTime: new Date(endTime.getTime() - 60 * 60 * 1000), endTime}
  }

  const value = parseInt(match[1]!, 10)
  const unit = match[2]!

  let ms: number
  switch (unit) {
    case 'm':
      ms = value * 60 * 1000
      break
    case 'h':
      ms = value * 60 * 60 * 1000
      break
    case 'd':
      ms = value * 24 * 60 * 60 * 1000
      break
    default:
      ms = 60 * 60 * 1000
  }

  return {startTime: new Date(endTime.getTime() - ms), endTime}
}

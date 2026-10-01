import {executeLogsQuery, type LogsQueryOptions} from './logs-query.js'
import {getAppConfigurationContext} from '../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {cwd} from '@shopify/cli-kit/node/path'

export interface LogsScopeOptions extends Pick<LogsQueryOptions, 'noPrompt' | 'demo'> {
  clientId?: string
  path?: string
  config?: string
}

interface LogsSearchOptions extends LogsScopeOptions {
  types?: string[]
  since?: string
  until?: string
  limit?: number
  shop?: string
  statusCode?: string
  sort?: string
  offset?: number
}

export async function resolveLogsApp(options: LogsScopeOptions): Promise<string> {
  if (options.clientId !== undefined) {
    if (!options.clientId.trim()) throw new AbortError('Provide a nonempty --client-id.')
    return options.clientId
  }
  const {activeConfig} = await getAppConfigurationContext(options.path ?? cwd(), options.config, {
    skipPrompts: options.noPrompt,
  })
  if (activeConfig.file.errors.length > 0) {
    throw new AbortError(activeConfig.file.errors.map((error) => error.message).join('\n'))
  }
  const clientId = activeConfig.file.content.client_id
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new AbortError('Set client_id in your app configuration or pass --client-id.')
  }
  return clientId
}

export async function searchLogs(options: LogsSearchOptions): Promise<Awaited<ReturnType<typeof executeLogsQuery>>> {
  const now = new Date()
  const endTime = options.until === undefined ? now.toISOString() : parseTimestamp(options.until, '--until')
  const since = options.since ?? '1h'
  const duration = /^(\d+)(s|m|h|d)$/.exec(since)
  const units = new Map([
    ['s', 1000],
    ['m', 60000],
    ['h', 3600000],
    ['d', 86400000],
  ])
  const durationMs = duration ? Number(duration[1]) * units.get(duration[2]!)! : undefined
  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs > 3600000)) {
    throw new AbortError('Search a time range of at most one hour.')
  }
  const startTime = duration
    ? new Date(Date.parse(endTime) - durationMs!).toISOString()
    : parseTimestamp(since, '--since')
  if (Date.parse(startTime) >= Date.parse(endTime)) throw new AbortError('--since must be earlier than --until.')
  if (Date.parse(endTime) - Date.parse(startTime) > 3600000)
    throw new AbortError('Search a time range of at most one hour.')
  if (options.statusCode !== undefined && (options.types?.length !== 1 || options.types[0] !== 'WEBHOOK_DELIVERY')) {
    throw new AbortError('--status-code requires --type WEBHOOK_DELIVERY.')
  }
  const appKey = await resolveLogsApp(options)
  const filters = []
  if (options.shop !== undefined) filters.push({column: 'SHOP_DOMAIN', op: 'EQUALS', values: [options.shop]})
  if (options.statusCode !== undefined)
    filters.push({column: 'WEBHOOK_STATUS_CODE', op: 'EQUALS', values: [options.statusCode]})
  const search = {
    startTime,
    endTime,
    types: options.types,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    sort: options.sort,
    ...(filters.length > 0 ? {filterGroup: {filters}} : {}),
  }
  const result = await executeLogsQuery({
    noPrompt: options.noPrompt,
    demo: options.demo,
    query: `query Logs($appKey: String!, $search: AppLogSearchInput!) {
      app(key: $appKey) {
        logs(input: $search) {
          appKey limit offset limitReached exhaustive ordering
          events {
            recordUid timestamp type shopDomain
            webhookDelivery { topic statusCode responseTimeMs deliveryAttempt }
            functionRun { functionHandle target resultStatus executionDurationMs errorType }
          }
        }
      }
    }`,
    variables: JSON.stringify({appKey, search}),
  })
  return {
    ...result,
    response: {
      ...result.response,
      extensions: {...result.response.extensions, logQuery: {appKey, ...search}},
    },
  }
}

function parseTimestamp(value: string, flag: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new AbortError(`${flag} must be an ISO 8601 timestamp with a timezone.`)
  }
  return value
}

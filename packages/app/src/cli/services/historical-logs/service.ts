import {logError} from './catalog.js'
import {connectLogs, failOnErrors, logsRequest} from './api.js'
import {prepareLogInput, resolveLogWindow, type LogInput} from './input.js'
import {historicalLogsSchema} from './response.js'
import {logsOutput, type LogsResult} from './types.js'
import {getAppConfigurationContext} from '../../models/app/loader.js'
import {HistoricalLogs} from '../../api/graphql/app-logs/generated/historical-logs.js'
import {cwd} from '@shopify/cli-kit/node/path'

interface LogScopeOptions {
  'client-id'?: string
  path?: string
  config?: string
  'no-input'?: boolean
}

export async function retrieveLogs(options: LogScopeOptions & LogInput): Promise<LogsResult> {
  const prepared = prepareLogInput(options)
  const clientId = await resolveLogApp(options)
  const connection = await connectLogs(clientId, options['no-input'] ?? false)
  const window = resolveLogWindow(prepared.window)
  const result = await logsRequest(connection, HistoricalLogs, {
    clientId,
    types: prepared.types.map(({backend}) => backend),
    timestamp: {gte: window.since, lt: window.until},
    limit: prepared.limit,
    filters: prepared.filters,
    ...(prepared.ordering === 'none' ? {} : {sortKey: 'TIMESTAMP', reverse: prepared.ordering === 'timestamp-desc'}),
  })
  failOnErrors(result)
  const response = historicalLogsSchema.safeParse(result.data)
  if (!response.success || !response.data.app?.logs)
    throw logError('INVALID_RESPONSE', 'App Logs returned no valid log result.')
  const records = response.data.app.logs.records.map(({json}) => json)
  if (
    records.length > prepared.limit ||
    records.some((record) => !prepared.types.some(({backend}) => backend === record.type))
  )
    throw logError('INVALID_RESPONSE', 'App Logs returned records outside the requested type or limit.')

  if (prepared.ordering === 'none') {
    records.sort((left, right) => {
      // Drop UTC's Z suffix so whole seconds sort before their fractional seconds, without losing precision.
      const leftTimestamp = left.timestamp.slice(0, -1)
      const rightTimestamp = right.timestamp.slice(0, -1)
      if (leftTimestamp < rightTimestamp) return -1
      if (leftTimestamp > rightTimestamp) return 1
      return 0
    })
  }

  return logsOutput.validate({
    logs: records,
    ordering: prepared.ordering === 'none' ? 'subset-timestamp-asc' : prepared.ordering,
    limitations:
      prepared.ordering === 'none'
        ? [
            'Used fast retrieval: returned records sorted oldest first in the CLI, not necessarily the oldest or newest matches. Additional records may match your search.',
          ]
        : [],
  })
}

async function resolveLogApp(options: LogScopeOptions): Promise<string> {
  if (options['client-id'] !== undefined) {
    if (!options['client-id'].trim()) throw logError('INVALID_ARGUMENT', '--client-id must not be empty.')
    return options['client-id']
  }
  const {activeConfig} = await getAppConfigurationContext(options.path ?? cwd(), options.config, {
    skipPrompts: options['no-input'] ?? false,
  })
  if (activeConfig.file.errors.length)
    throw logError('INVALID_ARGUMENT', activeConfig.file.errors.map(({message}) => message).join('\n'))
  const clientId = activeConfig.file.content.client_id
  if (typeof clientId !== 'string' || !clientId.trim())
    throw logError('INVALID_ARGUMENT', 'Pass --client-id or select an app configuration containing client_id.')
  return clientId
}

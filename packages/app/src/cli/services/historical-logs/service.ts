import {logError, logTypes} from './catalog.js'
import {connectLogs, failOnErrors, fetchLogScope, logsRequest} from './api.js'
import {prepareLogInput, resolveLogWindow, type LogInput} from './input.js'
import {functionSchema, webhookSchema, logsOutput} from './types.js'
import {getAppConfigurationContext} from '../../models/app/loader.js'
import {cwd} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

interface LogScopeOptions {
  'client-id'?: string
  path?: string
  config?: string
  'no-input'?: boolean
}

export async function retrieveLogs(options: LogScopeOptions & LogInput) {
  const prepared = prepareLogInput(options)
  const clientId = await resolveLogApp(options)
  const connection = await connectLogs(clientId, options['no-input'] ?? false)
  const {serverTime} = await fetchLogScope(connection)
  const window = resolveLogWindow(options, serverTime)
  const result = await logsRequest(
    connection,
    `query HistoricalLogs($clientId: String!, $input: AppLogSearchInput!) {
    app(clientId: $clientId) { logs(input: $input) {
      clientId limit limitReached exhaustive ordering events {
        id timestamp type shopDomain
        webhookDelivery { topic resultStatus statusCode responseTimeMs deliveryAttempt }
        functionRun { invocationId functionHandle target resultStatus executionDurationMs }
      }
    } }
  }`,
    {
      clientId,
      input: {
        startTime: window.since,
        endTime: window.until,
        limit: prepared.limit,
        types: prepared.backendTypes,
      },
    },
  )
  const response = zod
    .object({
      app: zod
        .object({
          logs: zod
            .object({
              clientId: zod.string(),
              limit: zod.number().int(),
              limitReached: zod.boolean(),
              exhaustive: zod.boolean(),
              ordering: zod.literal('NONE'),
              events: zod.array(
                zod.object({
                  id: zod.string(),
                  timestamp: zod.string(),
                  type: zod.string(),
                  shopDomain: zod.string().nullable(),
                  webhookDelivery: webhookSchema.nullable(),
                  functionRun: functionSchema.nullable(),
                }),
              ),
            })
            .nullable(),
        })
        .nullable(),
    })
    .safeParse(result.data)
  if (!response.success || !response.data.app?.logs) {
    failOnErrors(result)
    throw logError('INVALID_RESPONSE', 'App Logs returned no valid log result.')
  }
  const logs = response.data.app.logs
  if (logs.clientId !== clientId || logs.limit !== prepared.limit || logs.events.length > prepared.limit)
    throw logError('INVALID_RESPONSE', 'App Logs returned inconsistent query scope or limits.')
  return logsOutput.validate({
    status: result.errors?.length ? 'partial' : 'success',
    query: {
      clientId,
      types: prepared.types,
      ...window,
      clockSource: 'scope-response',
      limit: prepared.limit,
    },
    logs: logs.events.map((event) => {
      const type = logTypes.find(({backend}) => backend === event.type)?.name
      if (!type || !prepared.types.includes(type))
        throw logError('INVALID_RESPONSE', 'App Logs returned an event outside the selected types.')
      const status = event.webhookDelivery?.resultStatus ?? event.functionRun?.resultStatus
      const outcomes: Record<string, 'success' | 'failure'> = {
        RESULT_STATUS_SUCCESS: 'success',
        RESULT_STATUS_FAILURE: 'failure',
      }
      return {
        gid: event.id,
        timestamp: event.timestamp,
        type,
        storeDomain: event.shopDomain,
        outcome: status ? (outcomes[status] ?? null) : null,
        webhook: event.webhookDelivery,
        function: event.functionRun,
      }
    }),
    ordering: 'none',
    pageInfo: {
      limit: prepared.limit,
      returnedCount: logs.events.length,
      limitReached: logs.limitReached,
      moreRecordsMatched: null,
    },
    errors: (result.errors ?? []).map(({message, path}) => ({
      code: 'PARTIAL_RESULT',
      message,
      ...(path ? {fieldPath: path} : {}),
    })),
    limitations: [
      'Unordered results; additional matching records may exist. No pagination or ingestion-completeness guarantee.',
      'The default upper bound uses the app scope response’s server time. Query-start anchoring requires a backend change.',
      'Detailed fields are available only for webhooks and Functions. Restricted Function payloads are not requested.',
    ],
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

import {logError} from './catalog.js'
import {LogApp} from '../../api/graphql/app-management/generated/log-app.js'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {graphqlRequest, type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {zod} from '@shopify/cli-kit/node/schema'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {ClientError} from 'graphql-request'

const graphqlError = zod.object({
  message: zod.string(),
  path: zod.array(zod.union([zod.string(), zod.number()])).optional(),
  extensions: zod.record(zod.unknown()).optional(),
})
const responseSchema = zod.object({
  data: zod.record(zod.unknown()).nullable().optional(),
  errors: zod.array(graphqlError).optional(),
})

interface LogsConnection {
  clientId: string
  url: string
  token: () => string
  unauthorizedHandler: UnauthorizedHandler
}

export async function connectLogs(clientId: string, noInput: boolean): Promise<LogsConnection> {
  if (getAppAutomationToken())
    throw logError(
      'AUTHENTICATION_REQUIRED',
      'App Logs requires a CLI user session; automation tokens are not supported.',
    )

  const session = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: noInput})
  let token = session.appManagementToken
  const unauthorizedHandler: UnauthorizedHandler = {
    type: 'token_refresh',
    handler: async () => {
      const refreshed = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: true, forceRefresh: true})
      token = refreshed.appManagementToken
      return {token}
    },
  }
  const result = await appManagementRequestDoc({query: LogApp, token, variables: {clientId}, unauthorizedHandler})
  const app = zod
    .object({key: zod.literal(clientId), organizationId: zod.string().regex(/^gid:\/\/shopify\/Organization\/\d+$/)})
    .safeParse(result.app)
  if (!app.success) throw logError('FORBIDDEN', 'The selected app was not resolved to an authorized organization.')
  const organizationId = app.data.organizationId.split('/').at(-1)!
  const host = await appManagementFqdn()
  return {
    clientId,
    url: `https://${host}/app_logs/unstable/organizations/${organizationId}/graphql`,
    token: () => token,
    unauthorizedHandler,
  }
}

export async function logsRequest(connection: LogsConnection, query: string, variables: Record<string, unknown>) {
  let serverTime = ''
  try {
    const data = await graphqlRequest<unknown>({
      api: 'App Logs',
      url: connection.url,
      token: connection.token(),
      query,
      variables,
      unauthorizedHandler: connection.unauthorizedHandler,
      preferredBehaviour: {useNetworkLevelRetry: false, useAbortSignal: true, timeoutMs: 15000},
      responseOptions: {
        handleErrors: false,
        onResponse: (response) => {
          serverTime = response.headers.get('date') ?? ''
        },
      },
    })
    return {...parseResponse({data}), serverTime}
  } catch (error) {
    if (error instanceof ClientError) {
      if (error.response.status >= 200 && error.response.status < 300) {
        return {...parseResponse(error.response), serverTime}
      }
      const code =
        (
          {401: 'AUTHENTICATION_REQUIRED', 403: 'FORBIDDEN', 429: 'RATE_LIMITED', 504: 'QUERY_TIMEOUT'} as Record<
            number,
            string
          >
        )[error.response.status] ?? 'LOGS_API_UNAVAILABLE'
      throw logError(
        code,
        `App Logs request failed (HTTP ${error.response.status}). Check service availability and access.`,
      )
    }
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
      throw logError('QUERY_TIMEOUT', 'App Logs request timed out. Try a narrower time window.')
    }
    throw error
  }
}

export async function fetchLogScope(connection: LogsConnection) {
  const result = await logsRequest(
    connection,
    'query AppLogScope($clientId: String!) { app(clientId: $clientId) { clientId } }',
    {clientId: connection.clientId},
  )
  failOnErrors(result)
  if (!zod.object({clientId: zod.literal(connection.clientId)}).safeParse(result.data?.app).success)
    throw logError('INVALID_RESPONSE', 'App Logs returned invalid app scope metadata.')
  return {serverTime: result.serverTime}
}

export function failOnErrors(result: {errors?: zod.infer<typeof graphqlError>[]}) {
  if (!result.errors?.length) return
  const first = result.errors[0]!
  const code = typeof first.extensions?.code === 'string' ? first.extensions.code : 'LOG_QUERY_FAILED'
  const error = logError(code, result.errors.map(({message}) => message).join('\n'))
  error.details = {code, errors: result.errors}
  throw error
}

function parseResponse(body: unknown) {
  const result = responseSchema.safeParse(body)
  if (!result.success || (result.data.data === undefined && !result.data.errors?.length)) {
    throw logError('INVALID_RESPONSE', 'App Logs returned an invalid GraphQL response.')
  }
  return result.data
}

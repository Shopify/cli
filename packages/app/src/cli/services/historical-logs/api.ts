import {logError} from './catalog.js'
import {LogApp} from '../../api/graphql/app-management/generated/log-app.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {numericIdFromGid} from '@shopify/cli-kit/common/gid'
import {appManagementHeaders, appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {shopifyFetch, FetchError, requestMode} from '@shopify/cli-kit/node/http'
import {zod} from '@shopify/cli-kit/node/schema'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {resolveRequestDocument} from 'graphql-request'

const graphqlError = zod.object({
  message: zod.string(),
  path: zod.array(zod.union([zod.string(), zod.number()])).optional(),
  extensions: zod.record(zod.unknown()).optional(),
})
const responseSchema = zod.object({
  data: zod.record(zod.unknown()).nullable().optional(),
  errors: zod.array(graphqlError.passthrough()).optional(),
  extensions: zod.record(zod.unknown()).optional(),
})

const queryErrorCodes = new Map([
  ['THROTTLED', 'RATE_LIMITED'],
  ['TIMEOUT', 'QUERY_TIMEOUT'],
  ['SORTED_QUERY_TOO_LARGE', 'SORTED_QUERY_TOO_LARGE'],
])

interface LogsConnection {
  origin: string
  token: string
  organizationId: string
}

export async function connectLogs(clientId: string, noInput: boolean): Promise<LogsConnection> {
  if (getAppAutomationToken())
    throw logError(
      'AUTHENTICATION_REQUIRED',
      'Sign in with a user account to retrieve app logs. Automation tokens are not supported.',
    )
  const host = await appManagementFqdn()
  let {appManagementToken: token} = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: noInput})
  const origin = `https://${host}`
  const result = await appManagementRequestDoc({
    query: LogApp,
    token,
    variables: {clientId},
    unauthorizedHandler: {
      type: 'token_refresh',
      handler: async () => {
        const session = await ensureAuthenticatedAppManagementAndBusinessPlatform({
          noPrompt: noInput,
          forceRefresh: true,
        })
        token = session.appManagementToken
        return {token}
      },
    },
  })
  const app = zod
    .object({
      key: zod.string(),
      organizationId: zod
        .string()
        .regex(/^gid:\/\/shopify\/Organization\/\d+$/)
        .transform(numericIdFromGid)
        .pipe(zod.string()),
    })
    .safeParse(result.app)
  if (!app.success || app.data.key !== clientId) {
    throw logError('FORBIDDEN', 'The selected app was not resolved to an authorized organization.')
  }
  return {origin, token, organizationId: app.data.organizationId}
}

export async function logsRequest<TResult, TVariables extends Record<string, unknown>>(
  connection: LogsConnection,
  query: TypedDocumentNode<TResult, TVariables>,
  variables: NoInfer<TVariables>,
) {
  const response = await shopifyFetch(
    `${connection.origin}/app_logs/unstable/organizations/${connection.organizationId}/graphql`,
    {
      method: 'POST',
      redirect: 'error',
      headers: appManagementHeaders(connection.token),
      body: JSON.stringify({query: resolveRequestDocument(query).query, variables}),
    },
    requestMode('non-blocking'),
  ).catch((error: unknown) => {
    throwIfRequestFailed(error)
    throw error
  })
  const requestId = response.headers.get('x-request-id')
  const body: unknown = await response.json().catch((error: unknown) => {
    throwIfRequestFailed(error, requestId)
    if (!response.ok) return undefined
    throw logError('INVALID_RESPONSE', 'App Logs returned a response that could not be read as JSON.', requestId)
  })
  const result = responseSchema.safeParse(body)
  const errors = result.success ? result.data.errors : undefined
  if (!response.ok || errors?.length) {
    const graphqlCode = errors?.[0]?.extensions?.code
    const queryCode =
      typeof graphqlCode === 'string' && errors?.every(({extensions}) => extensions?.code === graphqlCode)
        ? queryErrorCodes.get(graphqlCode)
        : undefined
    const code = response.ok
      ? (queryCode ?? 'LOG_QUERY_FAILED')
      : ((
          {401: 'AUTHENTICATION_REQUIRED', 403: 'FORBIDDEN', 429: 'RATE_LIMITED', 504: 'QUERY_TIMEOUT'} as Record<
            number,
            string
          >
        )[response.status] ?? 'LOGS_API_UNAVAILABLE')
    const message = errors?.length
      ? errors.map(({message}) => message).join('\n')
      : 'Check API availability, access, and authentication.'
    const error = logError(
      code,
      response.ok ? message : `App Logs request failed (HTTP ${response.status}). ${message}`,
      requestId,
    )
    const retryAfter = response.headers.get('retry-after')
    const details = {
      ...(requestId ? {requestId} : {}),
      ...(result.success && errors?.length
        ? {
            errors,
            ...(result.data.extensions === undefined ? {} : {extensions: result.data.extensions}),
          }
        : {}),
      ...(retryAfter && /^\d+$/.test(retryAfter) ? {retryAfterSeconds: Number(retryAfter)} : {}),
    }
    if (Object.keys(details).length) error.details = details
    throw error
  }
  if (!result.success || (result.data.data === undefined && result.data.errors === undefined)) {
    throw logError('INVALID_RESPONSE', 'App Logs returned an invalid GraphQL response.', requestId)
  }
  return {...result.data, requestId}
}

function throwIfRequestFailed(error: unknown, requestId?: string | null): void {
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
    throw logError(
      'QUERY_TIMEOUT',
      'App Logs request timed out. Check backend availability or use a narrower window or more selective filters.',
      requestId,
    )
  }
  if (error instanceof FetchError && error.type !== 'invalid-json') {
    throw logError('LOGS_API_UNAVAILABLE', `App Logs request failed: ${error.message}`, requestId)
  }
}

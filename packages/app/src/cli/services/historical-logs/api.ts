import {logError} from './catalog.js'
import {LogApp} from '../../api/graphql/app-management/generated/log-app.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {appManagementHeaders, appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {fetch} from '@shopify/cli-kit/node/http'
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

interface LogsConnection {
  clientId: string
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
        .transform((gid) => gid.split('/').at(-1)!),
    })
    .safeParse(result.app)
  if (!app.success || app.data.key !== clientId) {
    throw logError('FORBIDDEN', 'The selected app was not resolved to an authorized organization.')
  }
  return {clientId, origin, token, organizationId: app.data.organizationId}
}

export async function logsRequest<TResult, TVariables extends Record<string, unknown>>(
  connection: LogsConnection,
  query: TypedDocumentNode<TResult, TVariables>,
  variables: NoInfer<TVariables>,
) {
  return requestGraphql(
    connection.origin,
    `/app_logs/unstable/organizations/${connection.organizationId}/graphql`,
    connection.token,
    resolveRequestDocument(query).query,
    variables,
  )
}

async function requestGraphql(
  origin: string,
  path: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(45000),
    headers: appManagementHeaders(token),
    body: JSON.stringify({query, variables}),
  }).catch((error: unknown) => {
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) {
      throw logError(
        'QUERY_TIMEOUT',
        'App Logs request timed out. Check backend availability or use a narrower window or more selective filters.',
      )
    }
    throw error
  })
  if (!response.ok) {
    const code =
      (
        {401: 'AUTHENTICATION_REQUIRED', 403: 'FORBIDDEN', 429: 'RATE_LIMITED', 504: 'QUERY_TIMEOUT'} as Record<
          number,
          string
        >
      )[response.status] ?? 'LOGS_API_UNAVAILABLE'
    const error = logError(
      code,
      `App Logs request failed (HTTP ${response.status}). Check API availability, access, and authentication.`,
    )
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter && /^\d+$/.test(retryAfter)) error.details = {retryAfterSeconds: Number(retryAfter)}
    throw error
  }
  const body: unknown = await response.json().catch(() => {
    throw logError('INVALID_RESPONSE', 'App Logs returned a response that could not be read as JSON.')
  })
  const result = responseSchema.safeParse(body)
  if (!result.success || (result.data.data === undefined && result.data.errors === undefined)) {
    throw logError('INVALID_RESPONSE', 'App Logs returned an invalid GraphQL response.')
  }
  return result.data
}

export function failOnErrors(result: zod.infer<typeof responseSchema>) {
  if (!result.errors?.length) return
  const error = logError('LOG_QUERY_FAILED', result.errors.map(({message}) => message).join('\n'))
  error.details = {
    errors: result.errors,
    ...(result.data === undefined ? {} : {data: result.data}),
    ...(result.extensions === undefined ? {} : {extensions: result.extensions}),
  }
  throw error
}

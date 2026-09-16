import {appManagementHeaders} from '@shopify/cli-kit/node/api/app-management'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {z} from 'zod'

const query = `
  query AppLogs($appKey: String!, $search: AppLogSearchInput!) {
    app(key: $appKey) {
      logs(input: $search) {
        appKey limit offset limitReached exhaustive ordering
        events { recordUid timestamp type resultStatus target shopDomain }
      }
    }
  }
`

const filterDefinitionsQuery = `
  query AppLogFilters($appKey: String!, $types: [LogEventType!]) {
    app(key: $appKey) {
      logFilterDefinitions(types: $types) { field description valueType operators }
    }
  }
`

const filterDefinitionsSchema = z.array(
  z.object({field: z.string(), description: z.string(), valueType: z.string(), operators: z.array(z.string())}),
)

const responseSchema = z.object({
  data: z
    .object({app: z.record(z.unknown()).nullable()})
    .nullable()
    .optional(),
  errors: z.array(z.object({message: z.string()})).optional(),
})

interface QueryOptions {
  clientId: string
  minutes: number
  limit: number
  offset: number
  types?: string[]
  filters?: string[]
  listFilters?: boolean
  demo: boolean
}

export async function queryAppLogs(options: QueryOptions): Promise<unknown> {
  if (process.env.SHOPIFY_APP_LOG_QUERY_PROTOTYPE !== '1' || process.env.SHOPIFY_SERVICE_ENV !== 'local') {
    throw new AbortError('Prototype only: set SHOPIFY_APP_LOG_QUERY_PROTOTYPE=1 and SHOPIFY_SERVICE_ENV=local.')
  }
  if (!options.clientId) {
    throw new AbortError('Provide a nonempty app client ID.')
  }
  if (options.listFilters && options.filters?.length) {
    throw new AbortError('Use --list-filters separately from --filter.')
  }
  if (
    !Number.isInteger(options.minutes) ||
    options.minutes < 1 ||
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    !Number.isInteger(options.offset) ||
    options.offset < 0
  ) {
    throw new AbortError('Use positive integers for minutes and limit, and a nonnegative integer for offset.')
  }

  const filters = options.filters?.map((filter) => {
    const separator = filter.indexOf('=')
    const column = filter.slice(0, separator).trim().toUpperCase()
    const value = filter.slice(separator + 1)
    if (separator < 1 || !/^[A-Z][A-Z_]*$/.test(column) || !value) {
      throw new AbortError('Use --filter FIELD=value. Use --list-filters to discover supported fields.')
    }
    return {column, op: 'EQUALS', values: [value]}
  })
  const {origin, token} = await queryConnection(options.demo)
  const end = new Date()
  const response = await fetch(`${origin}/api/unstable/graphql`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: appManagementHeaders(token),
    body: JSON.stringify({
      query: options.listFilters ? filterDefinitionsQuery : query,
      operationName: options.listFilters ? 'AppLogFilters' : 'AppLogs',
      variables: options.listFilters
        ? {appKey: options.clientId, types: options.types}
        : {
            appKey: options.clientId,
            search: {
              startTime: new Date(end.getTime() - options.minutes * 60 * 1000).toISOString(),
              endTime: end.toISOString(),
              limit: options.limit,
              offset: options.offset,
              ...(options.types ? {types: options.types} : {}),
              ...(filters?.length ? {filterGroup: {conjunction: 'AND', filters}} : {}),
            },
          },
    }),
  })
  if (!response.ok) {
    throw new AbortError(`Local log query failed (HTTP ${response.status}). Check the local API server output.`)
  }
  const result = responseSchema.safeParse(await response.json())
  if (!result.success) throw new AbortError('Local log query returned an invalid GraphQL response.')
  if (result.data.errors?.length) {
    throw new AbortError(`Local log query failed: ${result.data.errors.map((error) => error.message).join('; ')}`)
  }
  const app = result.data.data?.app
  if (options.listFilters) {
    const definitions = filterDefinitionsSchema.safeParse(app?.logFilterDefinitions)
    if (!definitions.success) throw new AbortError('Local log query returned invalid filter definitions.')
    return definitions.data
  }
  if (app && !('logs' in app)) throw new AbortError('Local log query returned an invalid GraphQL response.')
  if (!app?.logs) throw new AbortError('Local log query returned no app logs result.')
  const logs = z.record(z.unknown()).safeParse(app.logs)
  if (!logs.success) throw new AbortError('Local log query returned an invalid GraphQL response.')
  return logs.data
}

async function queryConnection(demo: boolean): Promise<{origin: string; token: string}> {
  if (demo) {
    const path = process.env.APP_LOG_QUERY_DEMO_TOKEN_FILE
    if (!path) throw new AbortError('Set APP_LOG_QUERY_DEMO_TOKEN_FILE to the file printed by the local demo server.')
    const token = (await readFile(path)).trim()
    if (!token.startsWith('atkn_') || token.length > 4096) throw new AbortError('Invalid demo token file.')
    return {origin: 'http://127.0.0.1:4387', token}
  }

  const host = await developerDashboardFqdn()
  if (host !== 'dev.shop.dev') throw new AbortError('This prototype can only call dev.shop.dev.')
  const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform()
  return {origin: `https://${host}`, token: appManagementToken}
}

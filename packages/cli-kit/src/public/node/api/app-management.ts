import {CacheOptions, GraphQLResponse, UnauthorizedHandler, graphqlRequestDoc} from './graphql.js'
import {addCursorAndFiltersToAppLogsUrl} from './utilities.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import {getEnvironmentVariables} from '../environment.js'
import {RequestModeInput} from '../http.js'
import Bottleneck from 'bottleneck'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {Variables} from 'graphql-request'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

async function setupRequest(token: string) {
  const api = 'App Management'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/app_management/unstable/graphql.json`

  const addedHeaders: {[key: string]: string} = {}

  // Add canary header if CANARY environment variable is set to '1'
  if (getEnvironmentVariables()['CANARY'] === '1') {
    addedHeaders['Shopify-Force-Canary'] = 'unstable'
  }

  return {
    token,
    api,
    url,
    addedHeaders,
    responseOptions: {onResponse: handleDeprecations},
  }
}

export const appManagementHeaders = (token: string): {[key: string]: string} => {
  const headers = buildHeaders(token)

  // Add canary header if CANARY environment variable is set to '1'
  if (getEnvironmentVariables()['CANARY'] === '1') {
    headers['Shopify-Force-Canary'] = 'unstable'
  }

  return headers
}

export const appManagementAppLogsUrl = async (
  organizationId: string,
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
): Promise<string> => {
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/app_management/unstable/organizations/${organizationId}/app_logs/poll`
  return addCursorAndFiltersToAppLogsUrl(url, cursor, filters)
}

export interface RequestOptions {
  requestMode: RequestModeInput
}

/**
 * @param orgId - The organization ID.
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @param cacheOptions - Cache options for the request. If not present, the request will not be cached.
 * @param requestOptions - Preferred behaviour for the request.
 * @param unauthorizedHandler - Optional handler for unauthorized requests.
 */
export interface AppManagementRequestOptions<TResult, TVariables extends Variables> {
  query: TypedDocumentNode<TResult, TVariables>
  token: string
  variables?: TVariables
  cacheOptions?: CacheOptions
  requestOptions?: RequestOptions
  unauthorizedHandler: UnauthorizedHandler
}

/**
 * Executes an org-scoped GraphQL query against the App Management API. Uses typed documents.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function appManagementRequestDoc<TResult, TVariables extends Variables>(
  options: AppManagementRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  const cacheExtraKey = options.cacheOptions?.cacheExtraKey ?? ''
  const newCacheOptions = options.cacheOptions ? {...options.cacheOptions, cacheExtraKey} : undefined

  const result = limiter.schedule<TResult>(async () =>
    graphqlRequestDoc<TResult, TVariables>({
      ...(await setupRequest(options.token)),
      query: options.query,
      variables: options.variables,
      cacheOptions: newCacheOptions,
      preferredBehaviour: options.requestOptions?.requestMode,
      unauthorizedHandler: options.unauthorizedHandler,
    }),
  )

  return result
}

interface Deprecation {
  supportedUntilDate?: string
}

interface WithDeprecations {
  deprecations: Deprecation[]
}

/**
 * Sets the next deprecation date from [GraphQL response extensions](https://www.apollographql.com/docs/resources/graphql-glossary/#extensions)
 * if `response.extensions.deprecations` objects contain a `supportedUntilDate` (ISO 8601-formatted string).
 *
 * @param response - The response of the query.
 */
export function handleDeprecations<T>(response: GraphQLResponse<T>): void {
  if (!response.extensions) return

  const deprecationDates: Date[] = []
  for (const deprecation of (response.extensions as WithDeprecations).deprecations) {
    if (deprecation.supportedUntilDate) {
      deprecationDates.push(new Date(deprecation.supportedUntilDate))
    }
  }

  setNextDeprecationDate(deprecationDates)
}

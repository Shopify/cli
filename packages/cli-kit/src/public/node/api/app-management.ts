import {addCursorAndFiltersToAppLogsUrl} from './utilities.js'
import {CacheOptions, UnauthorizedHandler, graphqlRequestDoc, handleDeprecations} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
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
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

export const appManagementHeaders = (token: string): Record<string, string> => {
  return buildHeaders(token)
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

export {handleDeprecations}

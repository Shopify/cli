import {graphqlRequestDoc, UnauthorizedHandler} from './graphql.js'
import {RequestOptions} from './app-management.js'
import {appDevFqdn, normalizeStoreFqdn} from '../context/fqdn.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'
import Bottleneck from 'bottleneck'
import {Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

// API Rate limiter
// Jobs are launched every 150ms
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

/**
 * @param query - GraphQL query to execute.
 * @param shopFqdn - The shop fqdn.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @param unauthorizedHandler - Unauthorized handler to use.
 */
export interface AppDevRequestOptions<TResult, TVariables extends Variables> {
  query: TypedDocumentNode<TResult, TVariables>
  shopFqdn: string
  token: string
  unauthorizedHandler: UnauthorizedHandler
  variables?: TVariables
  requestOptions?: RequestOptions
}
/**
 * Executes an org-scoped GraphQL query against the App Management API.
 * Uses typed documents.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function appDevRequestDoc<TResult, TVariables extends Variables>(
  options: AppDevRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  const api = 'App Dev'
  const normalizedShopFqdn = await normalizeStoreFqdn(options.shopFqdn)
  const fqdn = await appDevFqdn(normalizedShopFqdn)
  const url = `https://${fqdn}/app_dev/unstable/graphql.json`

  const addedHeaders = serviceEnvironment() === 'local' ? {'x-forwarded-host': normalizedShopFqdn} : undefined

  const result = limiter.schedule<TResult>(() =>
    graphqlRequestDoc<TResult, TVariables>({
      query: options.query,
      api,
      url,
      token: options.token,
      addedHeaders,
      variables: options.variables,
      unauthorizedHandler: options.unauthorizedHandler,
      preferredBehaviour: options.requestOptions?.requestMode,
    }),
  )

  return result
}

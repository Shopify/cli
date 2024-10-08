import {graphqlRequestDoc} from './graphql.js'
import {normalizeStoreFqdn} from '../context/fqdn.js'
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
 * Executes an org-scoped GraphQL query against the App Management API.
 * Uses typed documents.
 *
 * @param query - GraphQL query to execute.
 * @param shopFqdn - The shop fqdn.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function appDevRequest<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  shopFqdn: string,
  token: string,
  variables?: TVariables,
): Promise<TResult> {
  const api = 'App Dev'
  const normalizedShopFqdn = await normalizeStoreFqdn(shopFqdn)
  const url = `https://${normalizedShopFqdn}/app_dev/unstable/graphql.json`
  const result = limiter.schedule<TResult>(() =>
    graphqlRequestDoc<TResult, TVariables>({
      query,
      api,
      url,
      token,
      variables,
    }),
  )

  return result
}

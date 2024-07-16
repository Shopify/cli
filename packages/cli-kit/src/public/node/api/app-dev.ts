import {GraphQLResponse, graphqlRequestDoc} from './graphql.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
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
 * @param shopName - The shop name.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function appDevRequest<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  shopName: string,
  token: string,
  variables?: TVariables,
): Promise<TResult> {
  const api = 'App Dev'
  const url = `https://${shopName}/app_dev/unstable/graphql.json`
  const result = limiter.schedule<TResult>(() =>
    graphqlRequestDoc<TResult, TVariables>({
      query,
      api,
      url,
      token,
      variables,
      responseOptions: {onResponse: handleDeprecations},
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

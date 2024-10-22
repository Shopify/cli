import {GraphQLResponse, graphqlRequestDoc} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
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

async function setupRequest(orgId: string, token: string) {
  const api = 'App Management'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/app_management/unstable/organizations/${orgId}/graphql.json`
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * Executes an org-scoped GraphQL query against the App Management API. Uses typed documents.
 *
 * @param orgId - The organization ID.
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function appManagementRequestDoc<TResult, TVariables extends Variables>(
  orgId: string,
  query: TypedDocumentNode<TResult, TVariables>,
  token: string,
  variables?: TVariables,
): Promise<TResult> {
  const result = limiter.schedule<TResult>(async () =>
    graphqlRequestDoc<TResult, TVariables>({
      ...(await setupRequest(orgId, token)),
      query,
      variables,
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

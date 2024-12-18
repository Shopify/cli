import {graphqlRequestDoc} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
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
 * @param organizationId - Organization ID required to check permissions.
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function webhooksRequest<TResult, TVariables extends Variables>(
  organizationId: string,
  query: TypedDocumentNode<TResult, TVariables>,
  token: string,
  variables?: TVariables,
): Promise<TResult> {
  const api = 'Webhooks'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/webhooks/unstable/organizations/${organizationId}/graphql.json`
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

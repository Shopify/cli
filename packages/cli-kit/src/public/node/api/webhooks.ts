import {graphqlRequestDoc, UnauthorizedHandler} from './graphql.js'
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
 * Options for making requests to the Webhooks API.
 */
export interface WebhooksRequestOptions<TResult, TVariables extends Variables> {
  organizationId: string
  query: TypedDocumentNode<TResult, TVariables>
  token: string
  unauthorizedHandler: UnauthorizedHandler
  variables?: TVariables
}

/**
 * Executes an org-scoped GraphQL query against the App Management API.
 * Uses typed documents.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function webhooksRequestDoc<TResult, TVariables extends Variables>(
  options: WebhooksRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  const api = 'Webhooks'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/webhooks/unstable/organizations/${options.organizationId}/graphql.json`
  const result = limiter.schedule<TResult>(() =>
    graphqlRequestDoc<TResult, TVariables>({
      query: options.query,
      api,
      url,
      token: options.token,
      variables: options.variables,
      unauthorizedHandler: options.unauthorizedHandler,
    }),
  )

  return result
}

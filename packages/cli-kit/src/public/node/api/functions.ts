import {graphqlRequestDoc, UnauthorizedHandler} from './graphql.js'
import {handleDeprecations} from './app-management.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {Variables} from 'graphql-request'
import Bottleneck from 'bottleneck'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 0,
  maxConcurrent: 100,
})

/**
 * Prepares the request configuration for the App Management Functions API.
 *
 * @param orgId - Organization identifier.
 * @param token - Authentication token.
 * @param appId - App identifier.
 * @returns Request configuration object.
 */
async function setupRequest(orgId: string, token: string, appId: string) {
  const api = 'Functions'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/functions/unstable/organizations/${orgId}/${appId}/graphql`

  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * @param orgId - Organization identifier.
 * @param query - Typed GraphQL document node.
 * @param token - Authentication token.
 * @param appId - App identifier.
 * @param variables - Optional query variables.
 * @param unauthorizedHandler - Optional handler for unauthorized requests.
 */
export interface FunctionsRequestOptions<TResult, TVariables extends Variables> {
  organizationId: string
  query: TypedDocumentNode<TResult, TVariables>
  token: string
  appId: string
  unauthorizedHandler: UnauthorizedHandler
  variables?: TVariables
}

/**
 * Executes a rate-limited GraphQL request against the App Management Functions API.
 *
 * @param options - Request options.
 * @returns Promise resolving to the typed query result.
 */
export async function functionsRequestDoc<TResult, TVariables extends Variables>(
  options: FunctionsRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  const result = await limiter.schedule<TResult>(async () => {
    return graphqlRequestDoc<TResult, TVariables>({
      ...(await setupRequest(options.organizationId, options.token, options.appId)),
      query: options.query,
      variables: options.variables,
      unauthorizedHandler: options.unauthorizedHandler,
    })
  })

  return result
}

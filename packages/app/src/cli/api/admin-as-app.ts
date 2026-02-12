import {graphqlRequestDoc} from '@shopify/cli-kit/shared/node/api/graphql'
import {adminUrl} from '@shopify/cli-kit/admin/api'
import {AdminSession} from '@shopify/cli-kit/identity/session'
import {Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

/**
 * @param query - GraphQL query to execute.
 * @param session - Admin session.
 * @param variables - GraphQL variables to pass to the query.
 */
interface AdminAsAppRequestOptions<TResult, TVariables extends Variables> {
  query: TypedDocumentNode<TResult, TVariables>
  session: AdminSession
  variables?: TVariables
  autoRateLimitRestore?: boolean
}

/**
 * Sets up the request to the Shopify Admin API, on behalf of the app.
 *
 * @param session - Admin session.
 */
async function setupAdminAsAppRequest(session: AdminSession) {
  const api = 'Admin'
  const url = adminUrl(session.storeFqdn, 'unstable')
  return {
    token: session.token,
    api,
    url,
  }
}

/**
 * Executes a GraphQL query against the Shopify Admin API, on behalf of the app. Uses typed documents.
 *
 * If `autoRateLimitRestore` is true, the function will wait for a period of time such that the rate limit consumed by
 * the query is restored back to its original value. This means this function is suitable for use in loops with
 * multiple queries performed.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function adminAsAppRequestDoc<TResult, TVariables extends Variables>(
  options: AdminAsAppRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  return graphqlRequestDoc<TResult, TVariables>({
    query: options.query,
    ...(await setupAdminAsAppRequest(options.session)),
    variables: options.variables,
    autoRateLimitRestore: options.autoRateLimitRestore,
  })
}

import {graphqlRequestDoc} from './graphql.js'
import {AdminSession} from '../session.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {Variables} from 'graphql-request'

/**
 * Executes a GraphQL query against the Admin API on behalf of the app. Uses typed documents.
 *
 * @param query - GraphQL query to execute.
 * @param session - Admin session.
 * @param apiVersion - API version, e.g. '2024-07'.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <TResult>.
 */
export async function adminAsAppRequest<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  session: AdminSession,
  apiVersion: string,
  variables?: TVariables,
): Promise<TResult> {
  return graphqlRequestDoc<TResult, TVariables>({
    api: 'Admin',
    url: `https://${session.storeFqdn}/admin/api/${apiVersion}/graphql.json`,
    addedHeaders: {
      'X-Shopify-Access-Token': session.token,
    },
    query,
    variables,
  })
}

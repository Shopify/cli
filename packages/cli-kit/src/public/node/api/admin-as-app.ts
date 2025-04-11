import {graphqlRequest, GraphQLVariables} from './graphql.js'
import {AdminSession} from '../session.js'

/**
 * Executes a GraphQL query against the Admin API on behalf of the app. Uses string queries etc.
 *
 * @param query - GraphQL query to execute.
 * @param session - Admin session.
 * @param apiVersion - API version, e.g. '2024-07'.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <TResult>.
 */
export async function adminAsAppRequest<T>(
  query: string,
  session: AdminSession,
  apiVersion: string,
  variables?: GraphQLVariables,
): Promise<T> {
  return graphqlRequest<T>({
    api: 'Admin',
    url: `https://${session.storeFqdn}/admin/api/${apiVersion}/graphql.json`,
    addedHeaders: {
      'X-Shopify-Access-Token': session.token,
    },
    query,
    variables,
  })
}

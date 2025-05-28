import {graphqlRequest, GraphQLVariables} from './graphql.js'
import {AdminSession} from '../session.js'
import {parse} from 'graphql'

/**
 * Executes a GraphQL query against the Admin API on behalf of the app. Uses string queries etc.
 *
 * @param query - GraphQL query to execute.
 * @param allowMutation - Whether the query is a mutation.
 * @param session - Admin session.
 * @param apiVersion - API version, e.g. '2024-07'.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <TResult>.
 */
export async function adminAsAppRequest<T>(
  query: string,
  allowMutation: boolean,
  session: AdminSession,
  apiVersion: string,
  variables?: GraphQLVariables,
): Promise<
  | {
      status: 'blocked'
    }
  | {
      status: 'success'
      data: T
    }
> {
  if (!allowMutation) {
    const documentNode = parse(query)
    for (const definition of documentNode.definitions) {
      if (definition.kind === 'OperationDefinition') {
        const operationDefinition = definition
        if (operationDefinition.operation === 'mutation') {
          return {status: 'blocked'}
        }
      }
    }
  }

  const data = await graphqlRequest<T>({
    api: 'Admin',
    url: `https://${session.storeFqdn}/admin/api/${apiVersion}/graphql.json`,
    addedHeaders: {
      'X-Shopify-Access-Token': session.token,
    },
    query,
    variables,
  })

  return {status: 'success', data}
}

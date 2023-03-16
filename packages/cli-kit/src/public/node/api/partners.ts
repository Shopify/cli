import {partnersFqdn} from '../context/fqdn.js'
import {graphqlRequest, GraphQLResponse, GraphQLVariables} from '../../../private/node/api/graphql.js'

export {GraphQLResponse, GraphQLVariables}

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @param onResponse - Optional callback for the GraphQL response.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
  onResponse?: (response: GraphQLResponse<T>) => void,
): Promise<T> {
  const api = 'Partners'
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const handleErrors = true
  return graphqlRequest(query, api, url, token, variables, handleErrors, onResponse)
}

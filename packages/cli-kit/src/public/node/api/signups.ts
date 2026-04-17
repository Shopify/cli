import {GraphQLVariables, graphqlRequest} from './graphql.js'
import {handleDeprecations} from './partners.js'
import {signupsFqdn} from '../context/fqdn.js'

async function setupRequest(token: string) {
  const api = 'Signups'
  const fqdn = await signupsFqdn()
  const url = `https://${fqdn}/services/signups/graphql`
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * Executes a GraphQL query against the Signups API.
 * Uses the Identity bearer token directly (no application token exchange).
 *
 * @param query - GraphQL query to execute.
 * @param token - Identity access token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function signupsRequest<T>(query: string, token: string, variables?: GraphQLVariables): Promise<T> {
  return graphqlRequest<T>({
    ...(await setupRequest(token)),
    query,
    variables,
  })
}

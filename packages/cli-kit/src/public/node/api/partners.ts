import {partners as partnersFqdn} from '../../../environment/fqdn.js'
import {graphqlRequest} from '../../../private/node/api/graphql.js'
import {ScriptServiceProxyQuery} from '../../../api/graphql/index.js'

/**
 * Executes a GraphQL query against the Partners API.
 * @param query - GraphQL query to execute.
 * @param token - Partners token
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(
  query: string,
  token: string,
  variables?: {[key: string]: unknown},
): Promise<T> {
  const api = 'Partners'
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  return graphqlRequest(query, api, url, token, variables)
}

interface ProxyResponse {
  scriptServiceProxy: string
}

/**
 * Function queries are proxied through the script service proxy.
 * To execute a query, we encapsulate it inside another query (including the variables)
 * This is done automatically, you just need to provide the query and the variables.
 *
 * @param apiKey - APIKey of the app where the query will be executed.
 * @param query - GraphQL query to execute.
 * @param token - Partners token
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query.
 */
export async function functionProxyRequest<T>(
  apiKey: string,
  query: unknown,
  token: string,
  variables?: unknown,
): Promise<T> {
  const proxyVariables = {
    api_key: apiKey,
    query,
    variables: JSON.stringify(variables) || '{}',
  }
  const proxyQuery = ScriptServiceProxyQuery
  const res: ProxyResponse = await partnersRequest(proxyQuery, token, proxyVariables)
  const json = JSON.parse(res.scriptServiceProxy)
  return json as T
}

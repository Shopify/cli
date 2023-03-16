import {partnersFqdn} from '../context/fqdn.js'
import {graphqlRequest, GraphQLResponse, GraphQLVariables} from '../../../private/node/api/graphql.js'
import {gql} from 'graphql-request'
import {setNextDeprecationDate} from '../../../private/node/conf-store.js'

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(query: string, token: string, variables?: GraphQLVariables): Promise<T> {
  const api = 'Partners'
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const handleErrors = true
  return graphqlRequest(query, api, url, token, variables, handleErrors, {deprecationsHandler})
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
 * @param token - Partners token.
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
  const proxyResponse: ProxyResponse = await partnersRequest(proxyQuery, token, proxyVariables)
  const scriptServiceResponse = JSON.parse(proxyResponse.scriptServiceProxy)
  deprecationsHandler(scriptServiceResponse)

  return scriptServiceResponse as T
}

const ScriptServiceProxyQuery = gql`
  query ProxyRequest($api_key: String, $query: String!, $variables: String) {
    scriptServiceProxy(apiKey: $api_key, query: $query, variables: $variables)
  }
`

interface Deprecation {
  supportedUntilDate: string
}

interface WithDeprecations {
  deprecations: Deprecation[]
}

function deprecationsHandler<T>(response: GraphQLResponse<T>) {
  const deprecations = (response.extensions as WithDeprecations)?.deprecations
  if (deprecations) {
    const deprecationDates = deprecations.map(({supportedUntilDate}) => new Date(supportedUntilDate))
    setNextDeprecationDate(deprecationDates)
  }
}

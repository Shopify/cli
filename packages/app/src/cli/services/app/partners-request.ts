import {setNextDeprecationDate} from '../../private/node/deprecations/store.js'
import {partnersRequest as request, GraphQLResponse, GraphQLVariables} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(query: string, token: string, variables?: GraphQLVariables): Promise<T> {
  return request(query, token, variables, handleDeprecations)
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
  handleDeprecations(scriptServiceResponse)
  return scriptServiceResponse as T
}

const ScriptServiceProxyQuery = gql`
  query ProxyRequest($api_key: String, $query: String!, $variables: String) {
    scriptServiceProxy(apiKey: $api_key, query: $query, variables: $variables)
  }
`

interface Deprecation {
  supportedUntilDate?: string
}

interface WithDeprecations {
  deprecations: Deprecation[]
}

function handleDeprecations<T>(response: GraphQLResponse<T>) {
  if (!response.extensions) return

  const deprecationDates: Date[] = []
  for (const deprecation of (response.extensions as WithDeprecations).deprecations) {
    if (deprecation.supportedUntilDate) {
      deprecationDates.push(new Date(deprecation.supportedUntilDate))
    }
  }

  setNextDeprecationDate(deprecationDates)
}

import {buildHeaders, debugLogRequest, handlingErrors} from './common.js'
import {ScriptServiceProxyQuery} from './graphql/index.js'
import {partners as partnersFqdn} from '../environment/fqdn.js'
import {graphqlClient} from '../http/graphql.js'
import {Variables, ClientError, gql, RequestDocument} from 'graphql-request'
import {ResultAsync} from 'neverthrow'

export function request<T>(query: RequestDocument, token: string, variables?: Variables): ResultAsync<T, unknown> {
  const api = 'Partners'
  return handlingErrors(api, async () => {
    const fqdn = await partnersFqdn()
    const url = `https://${fqdn}/api/cli/graphql`
    const headers = await buildHeaders(token)
    debugLogRequest(api, query, variables, headers)
    const client = await graphqlClient({
      headers,
      service: 'partners',
      url,
    })
    const response = await client.request<T>(query, variables)
    return response
  })
}

/**
 * Check if the given token is revoked and no longer valid to interact with the Partners API.
 * @param token {string} - The token to check
 * @returns {Promise<boolean>} - True if the token is revoked, false otherwise
 */
export async function checkIfTokenIsRevoked(token: string): Promise<boolean> {
  const query = gql`
    {
      organizations(first: 1) {
        nodes {
          id
        }
      }
    }
  `
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  const client = await graphqlClient({
    headers,
    url,
    service: 'partners',
  })
  try {
    await client.request(query, {})
    return false
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    if (error instanceof ClientError) {
      return error.response.status === 401
    }
    return false
  }
}

interface ProxyResponse {
  scriptServiceProxy: string
}

/**
 * Function queries are proxied through the script service proxy.
 * To execute a query, we encapsulate it inside another query (including the variables)
 * This is done automatically, you just need to provide the query and the variables.
 *
 * @param apiKey {string} APIKey of the app where the query will be executed.
 * @param query {any} GraphQL query to execute.
 * @param token {string} Partners token
 * @param variables {any} GraphQL variables to pass to the query.
 * @returns {Promise<T>} The response of the query.
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
  return request<ProxyResponse>(proxyQuery, token, proxyVariables).match(
    (response) => JSON.parse(response.scriptServiceProxy) as T,
    (err) => {
      throw err
    },
  )
}

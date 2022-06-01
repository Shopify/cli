import {buildHeaders, sanitizedHeadersOutput} from './common'
import {ScriptServiceProxyQuery} from './graphql'
import {partners as partnersFqdn} from '../environment/fqdn'
import {debug, colorJson} from '../output'
import {Abort} from '../error'
import {request as graphqlRequest, Variables, RequestDocument, ClientError} from 'graphql-request'

export async function request<T>(query: RequestDocument, token: string, variables?: Variables): Promise<T> {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const headers = await buildHeaders(token)
  debug(`
Sending Partners GraphQL request:
${query}

With variables:
${variables ? JSON.stringify(variables, null, 2) : ''}

And headers:
${sanitizedHeadersOutput(headers)}
  `)

  try {
    const response = await graphqlRequest<T>(url, query, variables, headers)
    return response
  } catch (error) {
    if (error instanceof ClientError) {
      const errorMessage = `
The Partners GraphQL API responded unsuccessfully with the HTTP status ${error.response.status} and errors:

${colorJson(error.response.errors)}
      `
      throw new Abort(errorMessage)
    } else {
      throw error
    }
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    api_key: apiKey,
    query,
    variables: JSON.stringify(variables) || '{}',
  }
  const proxyQuery = ScriptServiceProxyQuery
  const res: ProxyResponse = await request(proxyQuery, token, proxyVariables)
  const json = JSON.parse(res.scriptServiceProxy)
  return json as T
}

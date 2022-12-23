import {buildHeaders, debugLogRequest, handlingErrors} from './common.js'
import {ScriptServiceProxyQuery} from './graphql/index.js'
import {partners as partnersFqdn} from '../environment/fqdn.js'
import {graphqlClient} from '../http/graphql.js'
import {debug} from '../output.js'
import {Variables, RequestDocument} from 'graphql-request'
import {performance} from 'perf_hooks'

export async function request<T>(query: RequestDocument, token: string, variables?: Variables): Promise<T> {
  const api = 'Partners'
  return handlingErrors(api, async () => {
    const fqdn = await partnersFqdn()
    const url = `https://${fqdn}/api/cli/graphql`
    const headers = await buildHeaders(token)
    debugLogRequest(api, query, variables, headers)
    const client = await graphqlClient({headers, url})
    const t0 = performance.now()
    const response = await client.request<T>(query, variables)
    const t1 = performance.now()
    debug(`Request to ${url.toString()} completed in ${Math.round(t1 - t0)} ms`)
    return response
  })
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
  const res: ProxyResponse = await request(proxyQuery, token, proxyVariables)
  const json = JSON.parse(res.scriptServiceProxy)
  return json as T
}

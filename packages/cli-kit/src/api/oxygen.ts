import {buildHeaders, debugLogRequest} from './common.js'
import {graphqlClient} from '../http/graphql.js'
import {shopifyFetch} from '../http.js'
import {Variables, RequestDocument} from 'graphql-request'
import FormData from 'form-data'
import {Response} from 'node-fetch'

export async function request<T>(
  oxygenAddress: string,
  query: RequestDocument,
  token: string,
  variables?: Variables,
): Promise<T> {
  const headers = await buildHeaders(token)
  debugLogRequest('Oxygen', query, variables, headers)
  const client = await graphqlClient({
    headers,
    url: getOxygenAddress(oxygenAddress),
  })

  const response = await client.request<T>(query, variables)
  return response
}

export async function uploadDeploymentFile(oxygenAddress: string, token: string, data: FormData): Promise<Response> {
  const headers = await buildHeaders(token)
  delete headers['Content-Type']

  const response = await shopifyFetch(getOxygenAddress(oxygenAddress), {
    method: 'POST',
    body: data,
    headers: {
      ...headers,
      ...data.getHeaders(),
    },
  })

  return response
}

const getOxygenAddress = (oxygenHost: string): string => {
  return `https://${oxygenHost}/api/graphql/deploy/v1`
}

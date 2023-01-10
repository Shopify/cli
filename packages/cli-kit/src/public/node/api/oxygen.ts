import {shopifyFetch} from '../../../http.js'
import {graphqlRequest} from '../../../private/common/api/graphql.js'
import {buildHeaders} from '../../../private/common/api/headers.js'
import {Variables, RequestDocument} from 'graphql-request'
import FormData from 'form-data'
import {Response} from 'node-fetch'

export async function oxygenRequest<T>(
  oxygenAddress: string,
  query: RequestDocument,
  token: string,
  variables?: Variables,
): Promise<T> {
  return graphqlRequest(query, 'Oxygen', getOxygenAddress(oxygenAddress), token, variables)
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

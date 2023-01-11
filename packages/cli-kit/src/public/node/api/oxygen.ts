import {shopifyFetch} from '../../../http.js'
import {graphqlRequest} from '../../../private/node/api/graphql.js'
import {buildHeaders} from '../../../private/node/api/headers.js'
import FormData from 'form-data'
import {Response} from 'node-fetch'

/**
 * Executes a GraphQL query against the Oxygen API.
 * @param oxygenAddress - Oxygen address to query.
 * @param query - GraphQL query to execute.
 * @param token - Shopify access token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function oxygenRequest<T>(
  oxygenAddress: string,
  query: string,
  token: string,
  variables?: {[key: string]: unknown},
): Promise<T> {
  return graphqlRequest(query, 'Oxygen', getOxygenAddress(oxygenAddress), token, variables)
}

/**
 * Uploads a deployment file to the Oxygen API.
 * @param oxygenAddress - Oxygen address to upload to.
 * @param token - Shopify access token.
 * @param data - FormData to upload.
 * @returns The response of the query.
 */
export async function uploadOxygenDeploymentFile(
  oxygenAddress: string,
  token: string,
  data: FormData,
): Promise<Response> {
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

import {buildHeaders, httpsAgent} from '../../../private/node/api/headers.js'
import {debugLogRequestInfo, errorHandler} from '../../../private/node/api/graphql.js'
import {debugLogResponseInfo} from '../../../private/node/api.js'
import {runWithTimer} from '../metadata.js'
import {GraphQLClient, rawRequest, RequestDocument, Variables} from 'graphql-request'

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type GraphQLResponse<T> = Awaited<ReturnType<typeof rawRequest<T>>>

export interface GraphQLRequestOptions<T> {
  query: RequestDocument
  api: string
  url: string
  token?: string
  addedHeaders?: {[header: string]: string}
  variables?: Variables
  responseOptions?: GraphQLResponseOptions<T>
}

export interface GraphQLResponseOptions<T> {
  handleErrors?: boolean
  onResponse?: (response: GraphQLResponse<T>) => void
}

/**
 * Executes a GraphQL query to an endpoint.
 *
 * @param options - GraphQL request options.
 * @returns The response of the query of generic type <T>.
 */
export async function graphqlRequest<T>(options: GraphQLRequestOptions<T>): Promise<T> {
  const {query, api, url, token, addedHeaders, variables, responseOptions} = options
  const headers = {
    ...addedHeaders,
    ...buildHeaders(token),
  }

  debugLogRequestInfo(api, query, variables, headers)
  const clientOptions = {agent: await httpsAgent(), headers}
  const client = new GraphQLClient(url, clientOptions)

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    const response = await debugLogResponseInfo(
      {request: client.rawRequest<T>(query as string, variables), url},
      responseOptions?.handleErrors === false ? undefined : errorHandler(api),
    )

    if (responseOptions?.onResponse) {
      responseOptions.onResponse(response)
    }

    return response.data
  })
}

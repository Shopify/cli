import {buildHeaders, httpsAgent} from '../../../private/node/api/headers.js'
import {debugLogRequestInfo, errorHandler} from '../../../private/node/api/graphql.js'
import {addPublicMetadata, runWithTimer} from '../metadata.js'
import {retryAwareRequest} from '../../../private/node/api.js'
import {GraphQLClient, rawRequest, RequestDocument, resolveRequestDocument, Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

// to replace TVariable type when there graphql query has no variables
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type GraphQLResponse<T> = Awaited<ReturnType<typeof rawRequest<T>>>

interface GraphQLRequestBaseOptions<TResult> {
  api: string
  url: string
  token?: string
  addedHeaders?: {[header: string]: string}
  responseOptions?: GraphQLResponseOptions<TResult>
}

type PerformGraphQLRequestOptions<TResult> = GraphQLRequestBaseOptions<TResult> & {
  queryAsString: string
  variables?: Variables
  unauthorizedHandler?: () => Promise<void>
}

export type GraphQLRequestOptions<T> = GraphQLRequestBaseOptions<T> & {
  query: RequestDocument
  variables?: Variables
  unauthorizedHandler?: () => Promise<void>
}

export type GraphQLRequestDocOptions<TResult, TVariables> = GraphQLRequestBaseOptions<TResult> & {
  query: TypedDocumentNode<TResult, TVariables> | TypedDocumentNode<TResult, Exact<{[key: string]: never}>>
  variables?: TVariables
  unauthorizedHandler?: () => Promise<void>
}

export interface GraphQLResponseOptions<T> {
  handleErrors?: boolean
  onResponse?: (response: GraphQLResponse<T>) => void
}

/**
 * Handles execution of a GraphQL query.
 *
 * @param options - GraphQL request options.
 */
async function performGraphQLRequest<TResult>(options: PerformGraphQLRequestOptions<TResult>) {
  const {token, addedHeaders, queryAsString, variables, api, url, responseOptions, unauthorizedHandler} = options
  const headers = {
    ...addedHeaders,
    ...buildHeaders(token),
  }

  debugLogRequestInfo(api, queryAsString, url, variables, headers)
  const clientOptions = {agent: await httpsAgent(), headers}
  const client = new GraphQLClient(url, clientOptions)

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    const response = await retryAwareRequest(
      {request: () => client.rawRequest<TResult>(queryAsString, variables), url},
      responseOptions?.handleErrors === false ? undefined : errorHandler(api),
      unauthorizedHandler,
    )

    if (responseOptions?.onResponse) {
      responseOptions.onResponse(response)
    }

    try {
      const requestId = response.headers.get('x-request-id')
      await addPublicMetadata(async () => {
        return {
          cmd_all_last_graphql_request_id: requestId ?? undefined,
        }
      })
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // no problem if unable to get request ID.
    }

    return response.data
  })
}

/**
 * Executes a GraphQL query to an endpoint.
 *
 * @param options - GraphQL request options.
 * @returns The response of the query of generic type <T>.
 */
export async function graphqlRequest<T>(options: GraphQLRequestOptions<T>): Promise<T> {
  return performGraphQLRequest<T>({
    ...options,
    queryAsString: options.query as string,
  })
}

/**
 * Executes a GraphQL query to an endpoint. Uses typed documents.
 *
 * @param options - GraphQL request options.
 * @returns The response of the query of generic type <TResult>.
 */
export async function graphqlRequestDoc<TResult, TVariables extends Variables>(
  options: GraphQLRequestDocOptions<TResult, TVariables>,
): Promise<TResult> {
  return performGraphQLRequest<TResult>({
    ...options,
    queryAsString: resolveRequestDocument(options.query).query,
  })
}

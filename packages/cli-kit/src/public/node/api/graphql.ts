import {buildHeaders, httpsAgent} from '../../../private/node/api/headers.js'
import {debugLogRequestInfo, errorHandler} from '../../../private/node/api/graphql.js'
import {addPublicMetadata, runWithTimer} from '../metadata.js'
import {retryAwareRequest} from '../../../private/node/api.js'
import {requestIdsCollection} from '../../../private/node/request-ids.js'
import {nonRandomUUID} from '../crypto.js'
import {cacheRetrieveOrRepopulate, GraphQLRequestKey} from '../../../private/node/conf-store.js'
import {
  GraphQLClient,
  rawRequest,
  RequestDocument,
  resolveRequestDocument,
  Variables,
  ClientError,
} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

// to replace TVariable type when there graphql query has no variables
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]}

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type GraphQLResponse<T> = Awaited<ReturnType<typeof rawRequest<T>>>

export type CacheTTL = '1h' | '6h' | '12h' | '1d' | '3d' | '7d' | '14d' | '30d'

interface GraphQLRequestBaseOptions<TResult> {
  api: string
  url: string
  token?: string
  addedHeaders?: {[header: string]: string}
  responseOptions?: GraphQLResponseOptions<TResult>
  cacheTTL?: CacheTTL
  cacheExtraKey?: string
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

  const performRequest = async () => {
    let fullResponse: GraphQLResponse<TResult>
    // there is a errorPolicy option which returns rather than throwing on errors, but we _do_ ultimately want to
    // throw.
    try {
      fullResponse = await client.rawRequest<TResult>(queryAsString, variables)
      await logLastRequestIdFromResponse(fullResponse)
      return fullResponse
    } catch (error) {
      if (error instanceof ClientError) {
        // error.response does have a headers property like a normal response, but it's not typed as such.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await logLastRequestIdFromResponse(error.response as any)
      }
      throw error
    }
  }

  const executeWithTimer = () =>
    runWithTimer('cmd_all_timing_network_ms')(async () => {
      const response = await retryAwareRequest(
        {request: performRequest, url},
        responseOptions?.handleErrors === false ? undefined : errorHandler(api),
        unauthorizedHandler,
      )

      if (responseOptions?.onResponse) {
        responseOptions.onResponse(response)
      }

      return response.data
    })

  const {cacheTTL, cacheExtraKey} = options

  // If there is no cache config for this query, just execute it and return the result.
  if (cacheTTL === undefined) {
    return executeWithTimer()
  }

  // If there is a cache config for this query, cache the result.
  const queryHash = nonRandomUUID(JSON.stringify(queryAsString))
  const variablesHash = nonRandomUUID(JSON.stringify(variables ?? {}))
  const cacheKey: GraphQLRequestKey = `q-${queryHash}-${variablesHash}-${cacheExtraKey ?? ''}`

  const result = await cacheRetrieveOrRepopulate(
    cacheKey,
    async () => {
      const result = await executeWithTimer()
      return JSON.stringify(result)
    },
    cacheTTLToMs(cacheTTL),
  )

  return JSON.parse(result) as TResult
}

async function logLastRequestIdFromResponse(response: GraphQLResponse<unknown>) {
  try {
    const requestId = response.headers.get('x-request-id')
    requestIdsCollection.addRequestId(requestId)
    await addPublicMetadata(() => ({
      cmd_all_last_graphql_request_id: requestId ?? undefined,
    }))
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // no problem if unable to get request ID.
  }
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

function cacheTTLToMs(cacheTTL: CacheTTL) {
  const oneHour = 1000 * 60 * 60
  const oneDay = 1000 * 60 * 60 * 24
  switch (cacheTTL) {
    case '1h':
      return oneHour
    case '6h':
      return oneHour * 6
    case '12h':
      return oneHour * 12
    case '1d':
      return oneDay
    case '3d':
      return oneDay * 3
    case '7d':
      return oneDay * 7
    case '14d':
      return oneDay * 14
    case '30d':
      return oneDay * 30
  }
}

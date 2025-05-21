import {buildHeaders, httpsAgent} from '../../../private/node/api/headers.js'
import {debugLogRequestInfo, errorHandler} from '../../../private/node/api/graphql.js'
import {addPublicMetadata, runWithTimer} from '../metadata.js'
import {retryAwareRequest} from '../../../private/node/api.js'
import {requestIdsCollection} from '../../../private/node/request-ids.js'
import {nonRandomUUID} from '../crypto.js'
import {
  cacheRetrieveOrRepopulate,
  ConfSchema,
  GraphQLRequestKey,
  TimeInterval,
  timeIntervalToMilliseconds,
} from '../../../private/node/conf-store.js'
import {LocalStorage} from '../local-storage.js'
import {abortSignalFromRequestBehaviour, requestMode, RequestModeInput} from '../http.js'
import {CLI_KIT_VERSION} from '../../common/version.js'
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

export interface CacheOptions {
  cacheTTL: TimeInterval
  cacheExtraKey?: string
  cacheStore?: LocalStorage<ConfSchema>
}

interface RefreshedTokenOnAuthorizedResponse {
  token?: string
}

export type RefreshTokenOnAuthorizedResponse = Promise<RefreshedTokenOnAuthorizedResponse>

interface SimpleUnauthorizedHandler {
  type: 'simple'
  handler: () => Promise<void>
}

interface TokenRefreshHandler {
  type: 'token_refresh'
  handler: () => RefreshTokenOnAuthorizedResponse
}

export type UnauthorizedHandler = SimpleUnauthorizedHandler | TokenRefreshHandler

interface GraphQLRequestBaseOptions<TResult> {
  api: string
  url: string
  token?: string
  addedHeaders?: {[header: string]: string}
  responseOptions?: GraphQLResponseOptions<TResult>
  cacheOptions?: CacheOptions
  preferredBehaviour?: RequestModeInput
}

type PerformGraphQLRequestOptions<TResult> = GraphQLRequestBaseOptions<TResult> & {
  queryAsString: string
  variables?: Variables
  unauthorizedHandler?: UnauthorizedHandler
  requestBehaviour?: RequestModeInput
}

export type GraphQLRequestOptions<T> = GraphQLRequestBaseOptions<T> & {
  query: RequestDocument
  variables?: Variables
  unauthorizedHandler?: UnauthorizedHandler
  requestBehaviour?: RequestModeInput
}

export type GraphQLRequestDocOptions<TResult, TVariables> = GraphQLRequestBaseOptions<TResult> & {
  query: TypedDocumentNode<TResult, TVariables> | TypedDocumentNode<TResult, Exact<{[key: string]: never}>>
  variables?: TVariables
  unauthorizedHandler?: UnauthorizedHandler
  requestBehaviour?: RequestModeInput
}

export interface GraphQLResponseOptions<T> {
  handleErrors?: boolean
  onResponse?: (response: GraphQLResponse<T>) => void
}

async function createGraphQLClient({
  url,
  addedHeaders,
  token,
}: {
  url: string
  token: string | undefined
  addedHeaders?: {[header: string]: string}
}) {
  const headers = {
    ...addedHeaders,
    ...buildHeaders(token),
  }
  const clientOptions = {agent: await httpsAgent(), headers}

  return {
    client: new GraphQLClient(url, clientOptions),
    headers,
  }
}

/**
 * Handles execution of a GraphQL query.
 *
 * @param options - GraphQL request options.
 */
async function performGraphQLRequest<TResult>(options: PerformGraphQLRequestOptions<TResult>) {
  const {token, addedHeaders, queryAsString, variables, api, url, responseOptions, unauthorizedHandler, cacheOptions} =
    options
  const requestBehaviour = requestMode(options.preferredBehaviour ?? 'default')

  let {headers, client} = await createGraphQLClient({url, addedHeaders, token})
  debugLogRequestInfo(api, queryAsString, url, variables, headers)

  const rawGraphQLRequest = async () => {
    let fullResponse: GraphQLResponse<TResult>
    // there is a errorPolicy option which returns rather than throwing on errors, but we _do_ ultimately want to
    // throw.
    try {
      // mapping signal to any due to polyfill meaning types don't exactly match (but are functionally equivalent)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.requestConfig.signal = abortSignalFromRequestBehaviour(requestBehaviour) as any
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

  const simpleUnauthorizedHandler = unauthorizedHandler?.type === 'simple' ? unauthorizedHandler.handler : undefined
  const tokenRefreshHandler = unauthorizedHandler?.type === 'token_refresh' ? unauthorizedHandler.handler : undefined

  const tokenRefreshUnauthorizedHandlerFunction = tokenRefreshHandler
    ? async () => {
        const refreshTokenResult = await tokenRefreshHandler()
        if (refreshTokenResult.token) {
          const {client: newClient, headers: newHeaders} = await createGraphQLClient({
            url,
            addedHeaders,
            token: refreshTokenResult.token,
          })
          client = newClient
          headers = newHeaders
          return true
        } else {
          return false
        }
      }
    : undefined

  const request = () =>
    retryAwareRequest(
      {request: rawGraphQLRequest, url, ...requestBehaviour},
      responseOptions?.handleErrors === false ? undefined : errorHandler(api),
      simpleUnauthorizedHandler,
    )

  const executeWithTimer = () =>
    runWithTimer('cmd_all_timing_network_ms')(async () => {
      let response
      try {
        response = await request()
      } catch (error) {
        if (error instanceof ClientError && error.response.status === 401 && tokenRefreshUnauthorizedHandlerFunction) {
          if (await tokenRefreshUnauthorizedHandlerFunction()) {
            response = await request()
          } else {
            throw error
          }
        } else {
          throw error
        }
      }

      if (responseOptions?.onResponse) {
        responseOptions.onResponse(response)
      }
      return response.data
    })

  // If there is no cache config for this query, just execute it and return the result.
  if (cacheOptions === undefined) {
    return executeWithTimer()
  }

  const {cacheTTL, cacheExtraKey, cacheStore} = cacheOptions

  // The cache key is a combination of the hashed query and variables, with an optional extra key provided by the user.
  const queryHash = nonRandomUUID(queryAsString)
  const variablesHash = nonRandomUUID(JSON.stringify(variables ?? {}))
  const cacheKey: GraphQLRequestKey = `q-${queryHash}-${variablesHash}-${CLI_KIT_VERSION}-${cacheExtraKey ?? ''}`

  const result = await cacheRetrieveOrRepopulate(
    cacheKey,
    async () => {
      const result = await executeWithTimer()
      return JSON.stringify(result)
    },
    timeIntervalToMilliseconds(cacheTTL),
    cacheStore,
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

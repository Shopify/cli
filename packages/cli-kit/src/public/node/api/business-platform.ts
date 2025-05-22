import {CacheOptions, GraphQLVariables, UnauthorizedHandler, graphqlRequest, graphqlRequestDoc} from './graphql.js'
import {handleDeprecations} from './partners.js'
import {businessPlatformFqdn} from '../context/fqdn.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {Variables} from 'graphql-request'

/**
 * Sets up the request to the Business Platform Destinations API.
 *
 * @param token - Business Platform token.
 */
async function setupRequest(token: string) {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const url = `https://${fqdn}/destinations/api/2020-07/graphql`
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * Executes a GraphQL query against the Business Platform Destinations API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Business Platform token.
 * @param variables - GraphQL variables to pass to the query.
 * @param cacheOptions - Cache options for the request. If not present, the request will not be cached.
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
): Promise<T> {
  return graphqlRequest<T>({
    ...(await setupRequest(token)),
    query,
    variables,
    cacheOptions,
  })
}

/**
 * @param query - GraphQL query to execute.
 * @param token - Business Platform token.
 * @param variables - GraphQL variables to pass to the query.
 * @param cacheOptions - Cache options for the request. If not present, the request will not be cached.
 */
export interface BusinessPlatformRequestOptions<TResult, TVariables extends Variables> {
  query: TypedDocumentNode<TResult, TVariables>
  token: string
  variables?: TVariables
  cacheOptions?: CacheOptions
  unauthorizedHandler: UnauthorizedHandler
}

/**
 * Executes a GraphQL query against the Business Platform Destinations API. Uses typed documents.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <TResult>.
 */
export async function businessPlatformRequestDoc<TResult, TVariables extends Variables>(
  options: BusinessPlatformRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  return graphqlRequestDoc<TResult, TVariables>({
    ...(await setupRequest(options.token)),
    query: options.query,
    variables: options.variables,
    cacheOptions: options.cacheOptions,
    unauthorizedHandler: options.unauthorizedHandler,
  })
}

/**
 * Sets up the request to the Business Platform Organizations API.
 *
 * @param token - Business Platform token.
 * @param organizationId - Organization ID as a numeric (non-GID) value.
 */
async function setupOrganizationsRequest(token: string, organizationId: string) {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const url = `https://${fqdn}/organizations/api/unstable/organization/${organizationId}/graphql`
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

export interface BusinessPlatformOrganizationsRequestNonTypedOptions {
  query: string
  token: string
  organizationId: string
  unauthorizedHandler: UnauthorizedHandler
  variables?: GraphQLVariables
}

/**
 * Executes a GraphQL query against the Business Platform Organizations API.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformOrganizationsRequest<T>(
  options: BusinessPlatformOrganizationsRequestNonTypedOptions,
): Promise<T> {
  return graphqlRequest<T>({
    query: options.query,
    ...(await setupOrganizationsRequest(options.token, options.organizationId)),
    variables: options.variables,
    unauthorizedHandler: options.unauthorizedHandler,
  })
}

export interface BusinessPlatformOrganizationsRequestOptions<TResult, TVariables extends Variables>
  extends BusinessPlatformRequestOptions<TResult, TVariables> {
  organizationId: string
}

/**
 * Executes a GraphQL query against the Business Platform Organizations API. Uses typed documents.
 *
 * @param options - The options for the request.
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformOrganizationsRequestDoc<TResult, TVariables extends Variables>(
  options: BusinessPlatformOrganizationsRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  return graphqlRequestDoc<TResult, TVariables>({
    query: options.query,
    ...(await setupOrganizationsRequest(options.token, options.organizationId)),
    variables: options.variables,
    unauthorizedHandler: options.unauthorizedHandler,
  })
}

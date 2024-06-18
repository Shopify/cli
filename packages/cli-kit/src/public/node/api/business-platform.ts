import {GraphQLVariables, graphqlRequest, graphqlRequestDoc} from './graphql.js'
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
 * @returns The response of the query of generic type <T>.
 */
export async function businessPlatformRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
): Promise<T> {
  return graphqlRequest<T>({
    ...(await setupRequest(token)),
    query,
    variables,
  })
}

/**
 * Executes a GraphQL query against the Business Platform Destinations API. Uses typed documents.
 *
 * @param query - GraphQL query to execute.
 * @param token - Business Platform token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <TResult>.
 */
export async function businessPlatformRequestDoc<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  token: string,
  variables?: TVariables,
): Promise<TResult> {
  return graphqlRequestDoc<TResult, TVariables>({
    ...(await setupRequest(token)),
    query,
    variables,
  })
}

import {graphqlRequestDoc} from './graphql.js'
import {handleDeprecations} from './app-management.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {gql, Variables} from 'graphql-request'
import Bottleneck from 'bottleneck'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

/**
 * Prepares the request configuration for the App Management Functions API.
 *
 * @param orgId - Organization identifier.
 * @param token - Authentication token.
 * @param appId - App identifier.
 * @returns Request configuration object.
 */
async function setupRequest(orgId: string, token: string, appId: string) {
  const api = 'Functions'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/functions/unstable/organizations/${orgId}/${appId}/graphql`

  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * Executes a rate-limited GraphQL request against the App Management Functions API.
 *
 * @param orgId - Organization identifier.
 * @param query - Typed GraphQL document node.
 * @param token - Authentication token.
 * @param appId - App identifier.
 * @param variables - Optional query variables.
 * @returns Promise resolving to the typed query result.
 */
export async function functionsRequestDoc<TResult, TVariables extends Variables>(
  orgId: string,
  query: TypedDocumentNode<TResult, TVariables>,
  token: string,
  appId: string,
  variables?: TVariables,
): Promise<TResult> {
  const result = await limiter.schedule<TResult>(async () => {
    return graphqlRequestDoc<TResult, TVariables>({
      ...(await setupRequest(orgId, token, appId)),
      query,
      variables,
    })
  })

  return result
}

// TODO: import these
interface AppLogsSubscribeVariables {
  shopIds: string[]
  apiKey: string
  token: string
}

interface AppLogsSubscribeResponse {
  appLogsSubscribe: {
    success: boolean
    errors?: string[]
    jwtToken: string
  }
}

const AppLogsSubscribeMutation = gql`
  mutation AppLogsSubscribe($apiKey: String!, $shopIds: [ID!]!) {
    appLogsSubscribe(input: {apiKey: $apiKey, shopIds: $shopIds}) {
      jwtToken
      success
      errors
    }
  }
`

/**
 * Subscribes to app logs through the Functions API.
 *
 * @param orgId - Organization identifier.
 * @param token - Authentication token.
 * @param appId - App identifier.
 * @param shopIds - Array of shop IDs to subscribe to.
 * @param apiKey - API key for the app.
 * @returns Promise resolving to the subscription response.
 */
export async function functionsAppLogsSubscribe(
  orgId: string,
  token: string,
  appId: string,
  shopIds: string[],
  apiKey: string,
): Promise<AppLogsSubscribeResponse> {
  return functionsRequestDoc(
    orgId,
    AppLogsSubscribeMutation as any,
    token,
    appId,
    {
      shopIds,
      apiKey,
    }
  )
}

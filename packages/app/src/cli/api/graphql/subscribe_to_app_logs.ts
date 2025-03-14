import {gql} from 'graphql-request'

export interface AppLogsSubscribeResponse {
  appLogsSubscribe: {
    success: boolean
    errors?: string[]
    jwtToken: string
  }
}

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const AppLogsSubscribeMutation = gql`
  mutation AppLogsSubscribe($apiKey: String!, $shopIds: [ID!]!) {
    appLogsSubscribe(input: {apiKey: $apiKey, shopIds: $shopIds}) {
      jwtToken
      success
      errors
    }
  }
`

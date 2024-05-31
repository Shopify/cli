import {gql} from 'graphql-request'

export interface AppLogsSubscribeVariables {
  shopIds: string[]
  apiKey: string
  token: string
}

export interface AppLogsSubscribeResponse {
  appLogsSubscribe: {
    success: boolean
    errors?: string[]
    jwtToken: string
  }
}

export const AppLogsSubscribeMutation = gql`
  mutation AppLogsSubscribe($apiKey: String!, $shopIds: [ID!]!) {
    appLogsSubscribe(input: {apiKey: $apiKey, shopIds: $shopIds}) {
      jwtToken
      success
      errors
    }
  }
`

import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'
import {Writable} from 'stream'

export interface AppLogsQueryOptions {
  shopIds: [string]
  apiKey: string
  token: string
}

const AppLogsSubscribeMutation = gql`
  mutation AppLogsSubscribe($input: AppLogsSubscribeInput!) {
    appLogsSubscribe(input: $input) {
      jwtToken
      success
      errors
    }
  }
`

export const subscribeToAppLogs = async ({stdout, options}: {stdout: Writable; options: AppLogsQueryOptions}) => {
  const result = await partnersRequest<{
    appLogsSubscribe: {
      jwtToken: string
      success: boolean
      errors: string[]
    }
  }>(AppLogsSubscribeMutation, options.token, {
    input: {shopIds: options.shopIds, apiKey: options.apiKey},
  })
  const {success, errors, jwtToken} = result.appLogsSubscribe

  stdout.write(`API Key: ${options.apiKey}\n`)

  return {success, errors, jwtToken}
}

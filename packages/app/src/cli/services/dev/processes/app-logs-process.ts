import {BaseProcess, DevProcessFunction} from './types.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {gql} from 'graphql-request'

export interface AppLogsQueryOptions {
  shopIds: [string]
  apiKey: string
  token: string
}

export interface AppLogsSubscribeProcess extends BaseProcess<AppLogsQueryOptions> {
  type: 'app-logs-subscribe'
}

interface Props {
  partnersSessionToken: string
  subscription: {
    shopIds: [string]
    apiKey: string
  }
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

export function setupAppLogsSubscribeProcess({
  partnersSessionToken,
  subscription: {shopIds, apiKey},
}: Props): AppLogsSubscribeProcess | undefined {
  return {
    type: 'app-logs-subscribe',
    prefix: 'app-events',
    function: subscribeToAppLogs,
    options: {
      shopIds, // For both requests
      apiKey, // For subscribe request
      token: partnersSessionToken, // For subscribe request
    },
  }
}

interface AppLog {
  logs?: string
  error_message?: string
  error_type?: string
  fuel_consumed?: number
  input?: string
  output?: string
  input_bytes?: number
  output_nytes?: number
  invocation_id?: string
  function_id?: string
}

export const subscribeToAppLogs: DevProcessFunction<AppLogsQueryOptions> = async ({stdout}, options) => {
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

  if (errors.length > 0) {
    errors.forEach((error) => {
      stdout.write(`Error: ${error}\n`)
    })
  } else {
    stdout.write(`Subscribed to App Events for SHOP ID(s) ${options.shopIds}\n`)
    stdout.write(`Success: ${success}\n`)
    stdout.write(`Token: ${jwtToken}\n`)
    stdout.write(`API Key: ${options.apiKey}\n`)
  }
}

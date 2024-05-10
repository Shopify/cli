import {BaseProcess, DevProcessFunction} from './types.js'
import {fetchAppLogs} from '../../app_logs/fetch_app_logs.js'
import {subscribeToAppLogs} from '../../app_logs/subscribe_app_logs.js'

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

export function setupAppLogsPollProcess({
  partnersSessionToken,
  subscription: {shopIds, apiKey},
}: Props): AppLogsSubscribeProcess | undefined {
  return {
    type: 'app-logs-subscribe',
    prefix: 'app-events',
    function: pollAppLogs,
    options: {
      shopIds,
      apiKey,
      token: partnersSessionToken,
    },
  }
}

export const pollAppLogs: DevProcessFunction<AppLogsQueryOptions> = async ({stdout}, options) => {
  stdout.write(`API Key: ${options.apiKey}\n`)

  const {jwtToken, success, errors} = await subscribeToAppLogs({stdout, options})

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
  await fetchAppLogs({stdout, appLogsFetchInput: {jwtToken}})
}

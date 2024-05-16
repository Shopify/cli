import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../../api/graphql/subscribe_to_app_logs.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'

import {outputDebug} from '@shopify/cli-kit/node/output'

interface SubscribeAndStartPollingOptions {
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeVariables
}

export interface AppLogsSubscribeProcess extends BaseProcess<SubscribeAndStartPollingOptions> {
  type: 'app-logs-subscribe'
}

interface Props {
  developerPlatformClient: DeveloperPlatformClient
  subscription: {
    shopIds: string[]
    apiKey: string
  }
}

export async function setupAppLogsPollingProcess({
  developerPlatformClient,
  subscription: {shopIds, apiKey},
}: Props): Promise<AppLogsSubscribeProcess> {
  const {token: partnersSessionToken} = await developerPlatformClient.session()

  return {
    type: 'app-logs-subscribe',
    prefix: 'app-logs',
    function: subscribeAndStartPolling,
    options: {
      developerPlatformClient,
      appLogsSubscribeVariables: {
        shopIds,
        apiKey,
        token: partnersSessionToken,
      },
    },
  }
}

export const subscribeAndStartPolling: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout},
  {developerPlatformClient, appLogsSubscribeVariables},
) => {
  const result = await developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${appLogsSubscribeVariables.apiKey}\n`)

  if (errors && errors.length > 0) {
    errors.forEach((error) => {
      stdout.write(`Error: ${error}\n`)
    })
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }

  const apiKey = appLogsSubscribeVariables.apiKey
  await createLogsDir(apiKey)
  await pollAppLogs({stdout, appLogsFetchInput: {jwtToken}, apiKey})
}

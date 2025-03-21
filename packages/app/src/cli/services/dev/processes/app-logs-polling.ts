import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../../api/graphql/subscribe_to_app_logs.js'
import {subscribeToAppLogs} from '../../app-logs/utils.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'

interface SubscribeAndStartPollingOptions {
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeVariables
  storeName: string
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
  storeName: string
}

export async function setupAppLogsPollingProcess({
  developerPlatformClient,
  subscription: {shopIds, apiKey},
  storeName,
}: Props): Promise<AppLogsSubscribeProcess> {
  const {token} = await developerPlatformClient.session()

  return {
    type: 'app-logs-subscribe',
    prefix: 'app-logs',
    function: subscribeAndStartPolling,
    options: {
      developerPlatformClient,
      appLogsSubscribeVariables: {
        shopIds,
        apiKey,
        token,
      },
      storeName,
    },
  }
}

export const subscribeAndStartPolling: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout, stderr: _stderr, abortSignal: _abortSignal},
  {developerPlatformClient, appLogsSubscribeVariables, storeName},
) => {
  try {
    const jwtToken = await subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables)

    const apiKey = appLogsSubscribeVariables.apiKey
    await createLogsDir(apiKey)

    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken},
      apiKey,
      resubscribeCallback: () => {
        return subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables)
      },
      developerPlatformClient,
      storeName,
    })
    // eslint-disable-next-line no-catch-all/no-catch-all,no-empty
  } catch (error) {}
}

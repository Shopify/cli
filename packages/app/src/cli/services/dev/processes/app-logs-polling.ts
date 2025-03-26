import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeMutationVariables} from '../../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {subscribeToAppLogs} from '../../app-logs/utils.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'

interface SubscribeAndStartPollingOptions {
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeMutationVariables
  storeName: string
  organizationId: string
}

export interface AppLogsSubscribeProcess extends BaseProcess<SubscribeAndStartPollingOptions> {
  type: 'app-logs-subscribe'
}

interface Props {
  developerPlatformClient: DeveloperPlatformClient
  subscription: {
    shopIds: number[]
    apiKey: string
  }
  storeName: string
  organizationId: string
}

export async function setupAppLogsPollingProcess({
  developerPlatformClient,
  subscription: {shopIds, apiKey},
  storeName,
  organizationId,
}: Props): Promise<AppLogsSubscribeProcess> {
  return {
    type: 'app-logs-subscribe',
    prefix: 'app-logs',
    function: subscribeAndStartPolling,
    options: {
      developerPlatformClient,
      appLogsSubscribeVariables: {
        shopIds,
        apiKey,
      },
      storeName,
      organizationId,
    },
  }
}

export const subscribeAndStartPolling: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout, stderr: _stderr, abortSignal: _abortSignal},
  {developerPlatformClient, appLogsSubscribeVariables, storeName, organizationId},
) => {
  try {
    const jwtToken = await subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables, organizationId)

    const apiKey = appLogsSubscribeVariables.apiKey
    await createLogsDir(apiKey)

    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken},
      apiKey,
      resubscribeCallback: () => {
        return subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables, organizationId)
      },
      developerPlatformClient,
      storeName,
      organizationId,
    })
    // eslint-disable-next-line no-catch-all/no-catch-all,no-empty
  } catch (error) {}
}

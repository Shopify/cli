import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeMutationVariables} from '../../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {subscribeToAppLogs} from '../../app-logs/utils.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'

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
  outputDebug(`Setting up app logs polling for apiKey: ${apiKey}, shop IDs: ${shopIds.join(',')}`)
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
    stdout.write('🔄 Initializing function logs...\n');
    outputInfo('Starting function logs polling')
    
    outputDebug(`Starting logs subscription for API key: ${appLogsSubscribeVariables.apiKey}`)
    
    const jwtToken = await subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables, organizationId)
    outputDebug('Successfully subscribed to app logs')
    stdout.write('✅ Successfully subscribed to function logs\n');

    const apiKey = appLogsSubscribeVariables.apiKey
    await createLogsDir(apiKey)
    outputDebug(`Created logs directory for API key: ${apiKey}`)

    stdout.write('👀 Watching for function logs...\n');
    
    // Start the polling process
    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken},
      apiKey,
      resubscribeCallback: () => {
        outputDebug('Resubscribing to app logs')
        return subscribeToAppLogs(developerPlatformClient, appLogsSubscribeVariables, organizationId)
      },
      developerPlatformClient,
      storeName,
      organizationId,
    })
  // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    stdout.write(`❌ Error setting up function logs: ${error instanceof Error ? error.message : String(error)}\n`);
    outputDebug(`Error in subscribeAndStartPolling: ${error instanceof Error ? error.message : String(error)}`)
  }
}

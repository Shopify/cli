import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs, pollAppLogs2} from '../../app-logs/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../../api/graphql/subscribe_to_app_logs.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'

import {outputDebug} from '@shopify/cli-kit/node/output'

interface SubscribeAndStartPollingOptions {
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeVariables
  filters?: {
    status?: string
    source?: string
  }
}

export interface AppLogsSubscribeProcess extends BaseProcess<SubscribeAndStartPollingOptions> {
  type: 'app-logs-subscribe'
}

interface Props {
  mode: 'dev' | 'logs'
  developerPlatformClient: DeveloperPlatformClient
  subscription: {
    shopIds: string[]
    apiKey: string
  }
  filters?: {
    status?: string
    source?: string
  }
}

export async function setupAppLogsPollingProcess({
  mode,
  developerPlatformClient,
  subscription: {shopIds, apiKey},
  filters,
}: Props): Promise<AppLogsSubscribeProcess> {
  const {token} = await developerPlatformClient.session()

  // workaroudn for now, refactor needed
  const processFunction = mode === 'dev' ? subscribeAndStartPolling : subscribeAndStartPolling2

  return {
    type: 'app-logs-subscribe',
    prefix: 'app-logs',
    function: processFunction,
    options: {
      developerPlatformClient,
      appLogsSubscribeVariables: {
        shopIds,
        apiKey,
        token,
      },
      filters,
    },
  }
}

export const subscribeAndStartPolling: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout, stderr, abortSignal},
  {developerPlatformClient, appLogsSubscribeVariables},
) => {
  const result = await developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${appLogsSubscribeVariables.apiKey}\n`)

  if (errors && errors.length > 0) {
    stdout.write(`Errors subscribing to app logs: ${errors.join(', ')}`)
    stdout.write('App log streaming is not available in this `dev` session.')
    return
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }

  const apiKey = appLogsSubscribeVariables.apiKey
  await createLogsDir(apiKey)
  await pollAppLogs({
    stdout,
    appLogsFetchInput: {jwtToken},
    apiKey,
    resubscribeCallback: () => {
      return subscribeAndStartPolling(
        {stdout, stderr, abortSignal},
        {developerPlatformClient, appLogsSubscribeVariables},
      )
    },
  })
}

export const subscribeAndStartPolling2: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout, stderr, abortSignal},
  {developerPlatformClient, appLogsSubscribeVariables, filters},
) => {
  const result = await developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${appLogsSubscribeVariables.apiKey}\n`)

  if (errors && errors.length > 0) {
    stdout.write(`Errors subscribing to app logs: ${errors.join(', ')}`)
    stdout.write('App log streaming is not available in this `dev` session.')
    return
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }

  const apiKey = appLogsSubscribeVariables.apiKey
  await createLogsDir(apiKey)
  await pollAppLogs2({
    stdout,
    appLogsFetchInput: {
      jwtToken,
      filters: {
        status: filters?.status,
        source: filters?.source,
      },
    },
    apiKey,
  })
}

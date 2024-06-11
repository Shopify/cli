import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/poll-app-logs.js'
import {
  AppEventData,
  AppLogsPollingCommandOutputFunction,
  AppLogsPollingCommandRetryOutputFunction,
  AppLogsPollingCommandErrorOutputFunction,
} from '../../app-logs/types.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeVariables} from '../../../api/graphql/subscribe_to_app_logs.js'

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

export interface CommandOutputOptions {
  commandOutputFunction: AppLogsPollingCommandOutputFunction
  retryOutputFunction: AppLogsPollingCommandRetryOutputFunction
  errorOutputFunction: AppLogsPollingCommandErrorOutputFunction
}

interface Props {
  outputFunctions: CommandOutputOptions
  developerPlatformClient: DeveloperPlatformClient
  subscription: {
    shopIds: string[]
    apiKey: string
  }
  filters?: {
    status?: string
    source?: string
  }
  appEventData?: AppEventData
}

export async function setupAppLogsPollingProcess({
  outputFunctions: {commandOutputFunction, retryOutputFunction, errorOutputFunction},
  developerPlatformClient,
  subscription: {shopIds, apiKey},
  filters,
}: Props): Promise<AppLogsSubscribeProcess> {
  const {token} = await developerPlatformClient.session()
  const processFunction = createSubscribeAndStartPolling(
    commandOutputFunction,
    retryOutputFunction,
    errorOutputFunction,
  )

  return {
    type: 'app-logs-subscribe',
    prefix: 'app-logs',
    // this starts polling, and uses the output function's to write to stdout once it polls
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

const createSubscribeAndStartPolling = (
  commandOutputFunction: AppLogsPollingCommandOutputFunction,
  retryOutputFunction: AppLogsPollingCommandRetryOutputFunction,
  errorOutputFunction: AppLogsPollingCommandErrorOutputFunction,
): DevProcessFunction<SubscribeAndStartPollingOptions> => {
  return async ({stdout, stderr, abortSignal}, {developerPlatformClient, appLogsSubscribeVariables, filters}) => {
    const result = await developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
    const {jwtToken, success, errors} = result.appLogsSubscribe
    outputDebug(`Token: ${jwtToken}\n`)
    outputDebug(`API Key: ${appLogsSubscribeVariables.apiKey}\n`)

    if (errors && errors.length > 0) {
      stdout.write(`Errors subscribing to app logs: ${errors.join(', ')}`)
      stdout.write('App log streaming is not available in this session.')
      return
    } else {
      outputDebug(`Subscribed to App Logs for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
      outputDebug(`Success: ${success}\n`)
    }
    const apiKey = appLogsSubscribeVariables.apiKey

    await pollAppLogs({
      stdout,
      appLogsFetchInput: {jwtToken, filters},
      apiKey,
      resubscribeCallback: () => {
        return createSubscribeAndStartPolling(
          commandOutputFunction,
          retryOutputFunction,
          errorOutputFunction,
        )({stdout, stderr, abortSignal}, {developerPlatformClient, appLogsSubscribeVariables, filters})
      },
      commandOutputFunction,
      retryOutputFunction,
      errorOutputFunction,
    })
  }
}

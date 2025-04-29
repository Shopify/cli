import {BaseProcess, DevProcessFunction} from './types.js'
import {pollAppLogs} from '../../app-logs/dev/poll-app-logs.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeMutationVariables} from '../../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {subscribeToAppLogs} from '../../app-logs/utils.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {AppEventWatcher, AppEvent} from '../app-events/app-event-watcher.js'

import {createLogsDir} from '@shopify/cli-kit/node/logs'
import {outputDebug} from '@shopify/cli-kit/node/output'

function hasFunctionExtensions(app: AppLinkedInterface): boolean {
  return app.allExtensions.some((extension) => extension.isFunctionExtension)
}

interface SubscribeAndStartPollingOptions {
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeMutationVariables
  storeName: string
  organizationId: string
  appWatcher: AppEventWatcher
  localApp: AppLinkedInterface
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
  appWatcher: AppEventWatcher
  localApp: AppLinkedInterface
}

export async function setupAppLogsPollingProcess({
  developerPlatformClient,
  subscription: {shopIds, apiKey},
  storeName,
  organizationId,
  appWatcher,
  localApp,
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
      appWatcher,
      localApp,
    },
  }
}

export const subscribeAndStartPolling: DevProcessFunction<SubscribeAndStartPollingOptions> = async (
  {stdout, stderr: _stderr, abortSignal: _abortSignal},
  {developerPlatformClient, appLogsSubscribeVariables, storeName, organizationId, appWatcher, localApp: _localApp},
) => {
  async function startPolling(abortSignal?: AbortSignal) {
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
      abortSignal,
    })
  }

  try {
    let logsStarted = false
    let pollingAbortController: AbortController | undefined

    const startPollingIfNeeded = async (appEvent: AppEvent) => {
      const hasFunctions = hasFunctionExtensions(appEvent.app)

      if (hasFunctions && !logsStarted) {
        outputDebug('Function extensions detected, starting logs polling')
        logsStarted = true
        pollingAbortController = new AbortController()

        try {
          await startPolling(pollingAbortController.signal)
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          outputDebug(`Failed to start function logs: ${error}`, _stderr)
        }
      } else if (!hasFunctions && logsStarted) {
        outputDebug('No function extensions detected, stopping logs polling')
        logsStarted = false
        pollingAbortController?.abort()
        pollingAbortController = undefined
      }
    }

    appWatcher.onStart(startPollingIfNeeded).onEvent(startPollingIfNeeded)
    // eslint-disable-next-line no-catch-all/no-catch-all,no-empty
  } catch (error) {}
}

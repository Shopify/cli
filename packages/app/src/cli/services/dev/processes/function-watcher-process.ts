import {BaseProcess, DevProcessFunction} from './types.js'
import {subscribeAndStartPolling} from './app-logs-polling.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {AppLogsSubscribeMutationVariables} from '../../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'

interface FunctionWatcherProcessOptions {
  appWatcher: AppEventWatcher
  developerPlatformClient: DeveloperPlatformClient
  appLogsSubscribeVariables: AppLogsSubscribeMutationVariables
  storeName: string
  organizationId: string
  logsActive: boolean
}

export interface FunctionWatcherProcess extends BaseProcess<FunctionWatcherProcessOptions> {
  type: 'function-watcher'
}

/**
 * Sets up a function extension watcher process.
 * This process watches for function extension creation and starts log polling when one is detected.
 *
 * @param options - The options for the function watcher process.
 * @returns The function watcher process.
 */
export async function setupFunctionWatcherProcess(
  options: FunctionWatcherProcessOptions,
): Promise<FunctionWatcherProcess> {
  return {
    type: 'function-watcher',
    prefix: `function-logs-watcher`,
    options,
    function: launchFunctionWatcher,
  }
}

export const launchFunctionWatcher: DevProcessFunction<FunctionWatcherProcessOptions> = async (
  {stdout, stderr, abortSignal},
  options: FunctionWatcherProcessOptions,
) => {
  const {appWatcher, logsActive, developerPlatformClient, appLogsSubscribeVariables, storeName, organizationId} =
    options

  // If logs are already active, we don't need to do anything
  if (logsActive) {
    outputDebug('Function logs already active, skipping function watcher', stdout)
    return
  }

  let logPollingStarted = false

  appWatcher.onEvent(async (appEvent) => {
    // Skip if logs polling already started
    if (logPollingStarted) return

    // Check if any function extension was created
    const hasFunctionExtension = appEvent.extensionEvents.some(
      (event) => (event.type === 'created' || event.type === 'changed') && event.extension.isFunctionExtension,
    )

    if (hasFunctionExtension && !logPollingStarted) {
      logPollingStarted = true
      outputInfo('Function extension detected - starting logs polling', stdout)

      // Start logs polling
      try {
        await subscribeAndStartPolling(
          {stdout, stderr, abortSignal},
          {developerPlatformClient, appLogsSubscribeVariables, storeName, organizationId},
        )
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        outputDebug(`Failed to start function logs: ${error}`, stderr)
      }
    }
  })
}

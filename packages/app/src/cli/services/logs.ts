import {DevContextOptions, ensureDevContext} from './context.js'
import {renderLogs} from './app-logs/logs-command/ui.js'
import {appLogPollingEnabled, subscribeToAppLogs} from './app-logs/utils.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {AppInterface} from '../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface LogsOptions {
  directory: string
  reset: boolean
  apiKey?: string
  storeFqdn?: string
  source?: string
  status?: string
  configName?: string
  userProvidedConfigName?: string
}

export async function logs(commandOptions: LogsOptions) {
  const logsConfig = await prepareForLogs(commandOptions)

  if (!appLogPollingEnabled()) {
    throw new AbortError(
      'This command is not released yet. You can experiment with it by setting SHOPIFY_CLI_ENABLE_APP_LOG_POLLING=1 in your env.',
    )
  }

  const variables = {
    shopIds: [logsConfig.storeId],
    apiKey: logsConfig.apiKey,
    token: '',
  }

  const jwtToken = await subscribeToAppLogs(logsConfig.developerPlatformClient, variables)

  const filters = {
    status: commandOptions.status,
    source: commandOptions.source,
  }

  const pollOptions = {
    jwtToken,
    filters,
  }

  await renderLogs({
    options: {
      variables,
      developerPlatformClient: logsConfig.developerPlatformClient,
    },
    pollOptions,
  })
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<{
  storeId: string
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  localApp: AppInterface
}> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: DevContextOptions = {...commandOptions, developerPlatformClient}
  const {storeId, remoteApp, localApp} = await ensureDevContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeId,
    developerPlatformClient,
    apiKey,
    localApp,
  }
}

import {LogsContextOptions, ensureLogsContext} from './context.js'
import {AppLogsSubscribeProcess, setupAppLogsPollingProcess} from './dev/processes/app-logs-polling.js'
import {renderLogs} from './app-logs/ui.js'
import {LOG_OUTPUT_FUNCTIONS} from './app-logs/services/output-functions.js'
import {AppInterface} from '../models/app/app.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'

export enum Flag {
  DeclarativeWebhooks,
}

export interface LogsOptions {
  apiKey?: string
  storeFqdn?: string
  path?: string
  source?: string
  status?: string
  configName?: string
  directory: string
  userProvidedConfigName?: string
  specifications?: ExtensionSpecification[]
  remoteFlags?: Flag[]
  reset: boolean
}

export async function logs(commandOptions: LogsOptions) {
  const config = await prepareForLogs(commandOptions)
  const process = await setupAppLogsPollingProcess({
    developerPlatformClient: config.developerPlatformClient,
    subscription: {
      shopIds: [config.storeId],
      apiKey: config.apiKey,
    },
    filters: {
      source: commandOptions.source,
      status: commandOptions.status,
    },
    outputFunctions: LOG_OUTPUT_FUNCTIONS,
  })
  await launchLogsProcess({process})
}

interface LogsConfig {
  localApp: AppInterface
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {
    apiSecret?: string | undefined
  }
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  storeId: string
  commandOptions: LogsOptions
  apiKey: string
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<LogsConfig> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: LogsContextOptions = {...commandOptions, developerPlatformClient}
  const {storeFqdn, storeId, remoteApp, localApp} = await ensureLogsContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeFqdn,
    storeId,
    remoteApp,
    localApp,
    developerPlatformClient,
    commandOptions,
    apiKey,
  }
}

async function launchLogsProcess({process}: {process: AppLogsSubscribeProcess}) {
  const abortController = new AbortController()

  const logsProcess: OutputProcess = {
    prefix: process.prefix,
    action: async (stdout, stderr, signal) => {
      const fn = process.function
      return fn({stdout, stderr, abortSignal: signal}, process.options)
    },
  }

  const renderLogParams = {
    logsProcess,
    abortController,
  }

  return renderLogs(renderLogParams)
}

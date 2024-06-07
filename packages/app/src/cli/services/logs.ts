import {LogsContextOptions, ensureLogsContext} from './context.js'
import {AppLogsSubscribeProcess, setupAppLogsPollingProcess} from './dev/processes/app-logs-polling.js'
import {renderLogs} from './app-logs/ui.js'
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
  remoateFlags?: Flag[]
  reset: boolean
}

export async function logs(commandOptions: LogsOptions) {
  // We should have everything in here we need to create the process and start polling
  const config = await prepareForLogs(commandOptions)

  // We only need 1 process - ??
  const process = await setupAppLogsPollingProcess({
    developerPlatformClient: config.developerPlatformClient,
    subscription: {
      shopIds: [config.storeId],
      apiKey: config.apiKey,
    },
  })

  // Launch the process
  await launchLogsProcess({process, config})
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

async function launchLogsProcess({process, config}: {process: AppLogsSubscribeProcess; config: LogsConfig}) {
  const abortController = new AbortController()
  // console.log(config)
  // console.log(process)

  // Create a OutputProcess from the process, needed for React component
  const logsProcess: OutputProcess = {
    prefix: process.prefix,
    action: async (stdout, stderr, signal) => {
      const fn = process.function
      return fn({stdout, stderr, abortSignal: signal}, process.options)
    },
  }
  // console.log(outputProcess)

  const apiKey = config.remoteApp.apiKey
  const developerPlatformClient = config.developerPlatformClient
  const app = {
    apiKey,
    developerPlatformClient,
    extensions: config.localApp.allExtensions,
  }

  const renderLogParams = {
    logsProcess,
    app,
    abortController,
  }

  // console.log('renderLog() params - this will render the react component', renderLogParams)
  return renderLogs(renderLogParams)
}

import {LogsContextOptions, ensureLogsContext} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'

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
  const config = await prepareForLogs(commandOptions)
  // We should have everything in here we need to create the process and start polling
  console.log(config)

  // Nexct steps: Create / re-use the app polling process
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

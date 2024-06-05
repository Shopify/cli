import {loadAppConfiguration} from '../models/app/loader.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export enum Flag {
  DeclarativeWebhooks,
}

export interface LogsOptions {
  apiKey?: string
  storeIds?: string[]
  path?: string
  source?: string
  status?: string
  // maybe? - to get the developer platform client
  configName?: string
  directory: string
  userProvidedConfigName?: string
  specifications?: ExtensionSpecification[]
  // remote flag?
  remoateFlags?: Flag[]
}

export async function logs(commandOptions: LogsOptions) {
  const {apiKey, storeIds, path, source, status} = commandOptions

  // Step 0: Load the App Configuration, to get the developer platform client
  // Needed for requesting logs
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })

  const developerPlatformClient = selectDeveloperPlatformClient({configuration})

  const {token: partnersSessionToken} = await developerPlatformClient.session()

  console.log('starting the app log command with these flags and dev platform client:', {
    apiKey,
    storeIds,
    path,
    source,
    status,
    myTokenNeeded: partnersSessionToken,
  })
  // Step 1: Subscribe to log streaming

  // Step 2: Poll app logs with the JWT token and cursor
}

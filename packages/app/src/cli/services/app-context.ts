import {appFromId, InvalidApiKeyErrorMessage} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {AppInterface, CurrentAppConfiguration} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationState, loadAppUsingConfigurationState} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'

export interface LoadedAppContextOutput {
  localApp: AppInterface<CurrentAppConfiguration, RemoteAwareExtensionSpecification>
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
}

export interface LoadedAppContextOptions {
  directory: string
  clientId?: string
  reset?: boolean
  configName?: string
  enableLinkingPrompt?: boolean
}

/**
 * Make sure we have a valid app: linked with a remote app and loaded in memory
 *
 * This function performs the following steps:
 * 1. Links the app if necessary
 * 2. Loads the app configuration
 * 4. Retrieves or selects an organization
 * 5. Fetches or selects a remote app
 * 6. Fetches app specifications
 * 7. Loads the local app
 * 8. Updates cached app information
 */
export async function linkedAndLoadedAppContext({
  directory,
  clientId,
  reset,
  configName,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  let configState = await getAppConfigurationState(directory, configName)
  let remoteApp: OrganizationApp | undefined
  if (configState.state === 'template-only' || reset) {
    // Link the app
    const result = await link({directory, apiKey: clientId, configName})
    remoteApp = result.remoteApp
    configState = {
      state: 'connected-app',
      basicConfiguration: result.configuration,
      appDirectory: directory,
      configurationPath: joinPath(directory, result.configFileName),
      configSource: configName ? 'flag' : 'cached',
      configurationFileName: result.configFileName,
    }
  }

  let developerPlatformClient = selectDeveloperPlatformClient({configuration: configState.basicConfiguration})
  if (!remoteApp) {
    const clientIdToFetchRemoteApp = clientId ?? configState.basicConfiguration.client_id
    remoteApp = await fetchAppFromCustomClientId(developerPlatformClient, clientIdToFetchRemoteApp)
  }
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  const localApp = await loadAppUsingConfigurationState(configState, {
    specifications,
    remoteFlags: remoteApp.flags,
    mode: 'strict',
  })

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === cachedInfo?.appId
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({appId: remoteApp.apiKey, title: remoteApp.title, directory, orgId: remoteApp.organizationId})
  }

  return {localApp, remoteApp, developerPlatformClient}
}

async function fetchAppFromCustomClientId(developerPlatformClient: DeveloperPlatformClient, clientId: string) {
  const remoteApp = await appFromId({apiKey: clientId, developerPlatformClient})
  if (!remoteApp) {
    const errorMessage = InvalidApiKeyErrorMessage(clientId)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return remoteApp
}

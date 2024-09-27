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

export interface LoadedAppContextOutput {
  app: AppInterface<CurrentAppConfiguration, RemoteAwareExtensionSpecification>
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
 * This function always returns an app that has been correctly linked and was loaded using the remote specifications.
 *
 * You can use a custom configName to load a specific config file.
 * In any case, if the selected config file is not linked, this function will force a link.
 *
 * @returns The local app, the remote app, and the developer platform client.
 */
export async function linkedAppContext({
  directory,
  clientId,
  reset,
  configName,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  // Get current app configuration state
  let configState = await getAppConfigurationState(directory, configName)
  let remoteApp: OrganizationApp | undefined

  // If the app is not linked, force a link.
  if (configState.state === 'template-only' || reset) {
    const result = await link({directory, apiKey: clientId, configName})
    remoteApp = result.remoteApp
    configState = result.state
  }

  // Fetch the remote app, using a different clientID if provided via flag.
  // Then update the current developerPlatformClient with the one from the remoteApp
  let developerPlatformClient = selectDeveloperPlatformClient({configuration: configState.basicConfiguration})
  if (!remoteApp) {
    const clientIdToFetchRemoteApp = clientId ?? configState.basicConfiguration.client_id
    remoteApp = await fetchAppFromCustomClientId(developerPlatformClient, clientIdToFetchRemoteApp)
  }
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the configuration state and the remote app's specifications
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

  return {app: localApp, remoteApp, developerPlatformClient}
}

async function fetchAppFromCustomClientId(developerPlatformClient: DeveloperPlatformClient, clientId: string) {
  const remoteApp = await appFromId({apiKey: clientId, developerPlatformClient})
  if (!remoteApp) {
    const errorMessage = InvalidApiKeyErrorMessage(clientId)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return remoteApp
}

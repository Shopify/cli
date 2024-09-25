import {appFromId, InvalidApiKeyErrorMessage, linkIfNecessary} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {AppInterface, isCurrentAppSchema} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadApp, loadAppConfiguration} from '../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface LoadedAppContextOutput {
  app: AppInterface
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
  enableLinkingPrompt,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  // This function handles the case where the app was never linked or using the `reset` flag.
  await linkIfNecessary(directory, reset ?? false, enableLinkingPrompt ?? true)

  const result = await loadAppConfiguration({directory, userProvidedConfigName: configName})
  let configuration = result.configuration
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  let remoteApp: OrganizationApp

  // If the user provides a clientId when the app is already linked, use that clientId just to fetch the remoteApp
  // If the user doesn't provide a clientId, and the app is linked, use the clientIf from the configuration file
  // If the app is not linked, link it, using the clientId from the flags if provided.
  if (clientId && configuration.client_id) {
    remoteApp = await fetchAppFromCustomClientId(developerPlatformClient, clientId)
  } else if (configuration.client_id) {
    const organizationId = isCurrentAppSchema(configuration) ? configuration.organization_id : undefined
    remoteApp = await appFromId({apiKey: String(configuration.client_id), developerPlatformClient, organizationId})
  } else {
    const result = await link({directory, apiKey: clientId})
    configuration = result.configuration
    remoteApp = result.remoteApp
  }

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  const localApp = await loadApp({
    directory,
    specifications,
    userProvidedConfigName: configName,
    remoteFlags: remoteApp.flags,
  })

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === cachedInfo?.appId
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({
      appId: remoteApp.apiKey,
      title: remoteApp.title,
      directory,
      orgId: remoteApp.organizationId,
    })
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

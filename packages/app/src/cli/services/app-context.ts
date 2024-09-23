import {appFromId, InvalidApiKeyErrorMessage, linkIfNecessary, selectOrg} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {selectOrCreateApp} from './dev/select-app.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {fetchAppRemoteConfiguration} from './app/select-app.js'
import {AppInterface} from '../models/app/app.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationShorthand, loadApp, loadAppConfiguration, loadAppName} from '../models/app/loader.js'
import {getOrganization} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface LoadedAppContextOutput {
  app: AppInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
}

export interface LoadedAppContextOptions {
  directory: string
  clientId: string
  reset: boolean
  configName?: string
  enableLinkingPrompt?: boolean
}

// NOTES: A user might pass a client-id, in that case we ignore the client-id from the app toml, and try to fetch the one provided.
export async function linkAndLoadedAppContext({
  directory,
  clientId,
  reset,
  configName,
  enableLinkingPrompt,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  await linkIfNecessary(directory, reset, enableLinkingPrompt ?? true)

  const cachedInfo = getCachedAppInfo(directory)

  const {configuration} = await loadAppConfiguration({directory, userProvidedConfigName: configName})

  let developerPlatformClient = selectDeveloperPlatformClient({configuration})

  let orgId = getOrganization() || cachedInfo?.orgId
  if (!orgId) {
    const org = await selectOrg()
    developerPlatformClient = selectDeveloperPlatformClient({organization: org, configuration})
    orgId = org.id
  }

  let remoteApp: OrganizationApp

  // If there is a clientId provided via flag, use that one, if not default to the one in the config.
  // If there isn't any, prompt to select a new app.
  const clientIdForRemoteApp = clientId ?? configuration.client_id
  if (clientIdForRemoteApp) {
    remoteApp = await appFromId({apiKey: clientId, developerPlatformClient})
    if (!remoteApp) {
      const errorMessage = InvalidApiKeyErrorMessage(clientId)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
  } else {
    const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(orgId)
    // get toml names somewhere close to here
    const localAppName = await loadAppName(directory)
    remoteApp = await selectOrCreateApp(localAppName, apps, hasMorePages, organization, developerPlatformClient)
  }

  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  remoteApp = {
    ...remoteApp,
    configuration: await fetchAppRemoteConfiguration(
      remoteApp,
      developerPlatformClient,
      specifications,
      remoteApp.flags,
    ),
  }

  const localApp = await loadApp({
    directory,
    specifications,
    userProvidedConfigName: getAppConfigurationShorthand(configuration.path),
    remoteFlags: remoteApp.flags,
  })

  // If the remoteApp is the same as the linked one, update the cached info.
  const rightApp = remoteApp.apiKey === cachedInfo?.appId
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({
      appId: remoteApp.apiKey,
      title: remoteApp.title,
      directory,
      orgId,
    })
  }

  return {app: localApp, remoteApp, developerPlatformClient}
}

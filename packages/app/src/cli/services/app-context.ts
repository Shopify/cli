import {appFromId} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationState, loadAppUsingConfigurationState} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AppLinkedInterface} from '../models/app/app.js'
import metadata from '../metadata.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'

export interface LoadedAppContextOutput {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  organization: Organization
  specifications: RemoteAwareExtensionSpecification[]
}

/**
 * Input options for the `linkedAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param forceRelink - Whether to force a relink of the app, this includes re-selecting the remote org and app.
 * @param clientId - The client ID to use when linking the app or when fetching the remote app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param unsafeReportMode - DONT USE THIS UNLESS YOU KNOW WHAT YOU ARE DOING. It means that the app loader will not throw an error when the app/extension configuration is invalid.
 * It is recommended to always use 'strict' mode unless the command can work with invalid configurations (like app info).
 */
interface LoadedAppContextOptions {
  directory: string
  forceRelink: boolean
  clientId: string | undefined
  userProvidedConfigName: string | undefined
  unsafeReportMode?: boolean
}

/**
 * This function always returns an app that has been correctly linked and was loaded using the remote specifications.
 *
 * You can use a custom configName to load a specific config file.
 * In any case, if the selected config file is not linked, this function will force a link.
 *
 * @returns The local app, the remote app, the correct developer platform client, and the remote specifications list.
 */
export async function linkedAppContext({
  directory,
  clientId,
  forceRelink,
  userProvidedConfigName,
  unsafeReportMode = false,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  // Get current app configuration state
  let configState = await getAppConfigurationState(directory, userProvidedConfigName) // loads toml and checks if its valid TOML format
  let remoteApp: OrganizationApp | undefined

  // If the app is not linked, force a link.
  if (configState.state === 'template-only' || forceRelink) {
    const result = await link({directory, apiKey: clientId, configName: userProvidedConfigName})
    remoteApp = result.remoteApp
    configState = result.state
  }

  // If the clientId is provided, update the configuration state with the new clientId
  if (clientId && clientId !== configState.basicConfiguration.client_id) {
    configState.basicConfiguration.client_id = clientId
  }

  // Fetch the remote app, using a different clientID if provided via flag.
  // Then update the current developerPlatformClient with the one from the remoteApp
  let developerPlatformClient = selectDeveloperPlatformClient({configuration: configState.basicConfiguration})
  if (!remoteApp) {
    const apiKey = configState.basicConfiguration.client_id
    const organizationId = configState.basicConfiguration.organization_id
    const id = configState.basicConfiguration.app_id
    remoteApp = await appFromId({apiKey, developerPlatformClient, organizationId, id})
  }
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the configuration state and the remote app's specifications
  const localApp = await loadAppUsingConfigurationState(configState, {
    // calls using the loader.ts
    specifications,
    remoteFlags: remoteApp.flags,
    mode: unsafeReportMode ? 'report' : 'strict',
  })

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === localApp.configuration.client_id
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({appId: remoteApp.apiKey, title: remoteApp.title, directory, orgId: remoteApp.organizationId})
  }

  await logMetadata(remoteApp, forceRelink)

  return {app: localApp, remoteApp, developerPlatformClient, specifications, organization}
  // local app is what is in your file system
  // remoteApp is what is in dd or partners. it has basic stuff in app - clientID name, secrets, flags, (ApiClient???)
  // we can request version/release information from other comma
}

async function logMetadata(app: {organizationId: string; apiKey: string}, resetUsed: boolean) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(app.organizationId),
    api_key: app.apiKey,
    cmd_app_reset_used: resetUsed,
  }))
}

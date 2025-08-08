import {appFromIdentifiers} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {Organization, OrganizationApp, OrganizationSource} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationState, loadAppUsingConfigurationState, loadApp} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AppLinkedInterface, AppInterface} from '../models/app/app.js'
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
 * Input options for the `localAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param unsafeReportMode - DONT USE THIS UNLESS YOU KNOW WHAT YOU ARE DOING. It means that the app loader will not throw an error when the app/extension configuration is invalid.
 * It is recommended to always use 'strict' mode unless the command can work with invalid configurations (like app info).
 */
interface LocalAppContextOptions {
  directory: string
  userProvidedConfigName?: string
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
  let configState = await getAppConfigurationState(directory, userProvidedConfigName)
  let remoteApp: OrganizationApp | undefined

  // If the app is not linked, force a link.
  if (configState.state === 'template-only' || forceRelink) {
    // If forceRelink is true, we don't want to use the cached config name and instead prompt the user for a new one.
    const configName = forceRelink ? undefined : configState.configurationFileName
    const result = await link({directory, apiKey: clientId, configName})
    remoteApp = result.remoteApp
    configState = result.state
  }

  // If the clientId is provided, update the configuration state with the new clientId
  if (clientId && clientId !== configState.basicConfiguration.client_id) {
    configState.basicConfiguration.client_id = clientId
  }

  // Fetch the remote app, using a different clientID if provided via flag.
  if (!remoteApp) {
    const apiKey = configState.basicConfiguration.client_id
    remoteApp = await appFromIdentifiers({apiKey})
  }
  const developerPlatformClient = remoteApp.developerPlatformClient

  const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the configuration state and the remote app's specifications
  const localApp = await loadAppUsingConfigurationState(configState, {
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

  await logMetadata(remoteApp, organization, forceRelink)

  // Add UIDs to extension TOML files if using app-management.
  // If in unsafe report mode, it is possible the UIDs are not loaded in memory
  // even if they are present in the file, so we can't be sure whether or not
  // it's necessary.
  if (!unsafeReportMode) {
    await addUidToTomlsIfNecessary(localApp.allExtensions, developerPlatformClient)
  }

  return {app: localApp, remoteApp, developerPlatformClient, specifications, organization}
}

async function logMetadata(app: {apiKey: string}, organization: Organization, resetUsed: boolean) {
  let organizationInfo: {partner_id?: number; business_platform_id?: number}
  if (organization.source === OrganizationSource.BusinessPlatform) {
    organizationInfo = {business_platform_id: tryParseInt(organization.id)}
  } else {
    organizationInfo = {partner_id: tryParseInt(organization.id)}
  }

  await metadata.addPublicMetadata(() => ({
    ...organizationInfo,
    api_key: app.apiKey,
    cmd_app_reset_used: resetUsed,
  }))
}

/**
 * This function loads an app locally without making any network calls.
 * It uses local specifications and doesn't require the app to be linked.
 *
 * @returns The local app instance.
 */
export async function localAppContext({
  directory,
  userProvidedConfigName,
}: LocalAppContextOptions): Promise<AppInterface> {
  // Load local specifications only
  const specifications = await loadLocalExtensionsSpecifications()

  // Load the local app using the specifications
  return loadApp({
    directory,
    userProvidedConfigName,
    specifications,
    mode: 'local',
  })
}

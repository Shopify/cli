import {appFromIdentifiers} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import {loadLocalExtensionsSpecifications} from '../models/extensions/load-specifications.js'
import {Organization, OrganizationApp, OrganizationSource} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationContext, loadAppFromContext} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AppLinkedInterface, AppInterface} from '../models/app/app.js'
import {Project} from '../models/project/project.js'
import metadata from '../metadata.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {basename} from '@shopify/cli-kit/node/path'
import type {ActiveConfig} from '../models/project/active-config.js'

export interface LoadedAppContextOutput {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  organization: Organization
  specifications: RemoteAwareExtensionSpecification[]
  project: Project
  activeConfig: ActiveConfig
}

/**
 * Input options for the `linkedAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param forceRelink - Whether to force a relink of the app, this includes re-selecting the remote org and app.
 * @param clientId - The client ID to use when linking the app or when fetching the remote app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param unsafeTolerateErrors - When true, the loaded app may contain validation errors without throwing.
 * Only use this for commands that explicitly handle invalid configs (e.g. `app info`, `app validate`).
 */
interface LoadedAppContextOptions {
  directory: string
  forceRelink: boolean
  clientId: string | undefined
  userProvidedConfigName: string | undefined
  unsafeTolerateErrors?: boolean
}

/**
 * Input options for the `localAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 */
interface LocalAppContextOptions {
  directory: string
  userProvidedConfigName?: string
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
  unsafeTolerateErrors = false,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  let {project, activeConfig} = await getAppConfigurationContext(directory, userProvidedConfigName)
  let remoteApp: OrganizationApp | undefined

  if (!activeConfig.isLinked || forceRelink) {
    const configName = forceRelink ? undefined : basename(activeConfig.file.path)
    const result = await link({directory, apiKey: clientId, configName})
    remoteApp = result.remoteApp
    // Re-load project and re-select active config since link may have written new config
    const reloaded = await getAppConfigurationContext(directory, result.configFileName)
    project = reloaded.project
    activeConfig = reloaded.activeConfig
  }

  // Determine the effective client ID
  const configClientId = activeConfig.file.content.client_id
  if (typeof configClientId !== 'string' || configClientId.length === 0) {
    throw new BugError(`Active config at ${activeConfig.file.path} is marked as linked but has no client_id`)
  }
  const effectiveClientId = clientId ?? configClientId

  // Fetch the remote app, using a different clientID if provided via flag.
  if (!remoteApp) {
    remoteApp = await appFromIdentifiers({apiKey: effectiveClientId})
  }
  const developerPlatformClient = remoteApp.developerPlatformClient

  const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the pre-resolved context and the remote app's specifications
  const localApp = await loadAppFromContext({
    project,
    activeConfig,
    specifications,
    remoteFlags: remoteApp.flags,
    clientIdOverride: clientId && clientId !== configClientId ? clientId : undefined,
  })

  if (!unsafeTolerateErrors && !localApp.errors.isEmpty()) {
    throw new AbortError(localApp.errors.toJSON()[0]!)
  }

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === localApp.configuration.client_id
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({appId: remoteApp.apiKey, title: remoteApp.title, directory, orgId: remoteApp.organizationId})
  }

  await logMetadata(remoteApp, organization, forceRelink)

  // Add UIDs to extension TOML files if using app-management.
  // Only safe when there are no errors — errors may mean UIDs weren't loaded correctly.
  if (localApp.errors.isEmpty()) {
    await addUidToTomlsIfNecessary(localApp.allExtensions, developerPlatformClient)
  }

  return {project, activeConfig, app: localApp, remoteApp, developerPlatformClient, specifications, organization}
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

interface LocalAppContextOutput {
  app: AppInterface
  project: Project
}

/**
 * This function loads an app locally without making any network calls.
 * It uses local specifications and doesn't require the app to be linked.
 *
 * @returns The local app and project instances.
 */
export async function localAppContext({
  directory,
  userProvidedConfigName,
}: LocalAppContextOptions): Promise<LocalAppContextOutput> {
  const {project, activeConfig} = await getAppConfigurationContext(directory, userProvidedConfigName)
  const specifications = await loadLocalExtensionsSpecifications()
  const app = await loadAppFromContext({project, activeConfig, specifications, ignoreUnknownExtensions: true})

  if (!app.errors.isEmpty()) {
    throw new AbortError(app.errors.toJSON()[0]!)
  }

  return {app, project}
}

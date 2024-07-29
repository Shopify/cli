import {selectOrCreateApp} from './dev/select-app.js'
import {fetchOrgFromId, fetchOrganizations} from './dev/fetch.js'
import {selectStore} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {createExtension} from './dev/create-extension.js'
import {CachedAppInfo, clearCachedAppInfo, getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import link from './app/config/link.js'
import {writeAppConfigurationFile} from './app/write-app-configuration-file.js'
import {fetchAppRemoteConfiguration} from './app/select-app.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {
  AppConfiguration,
  AppInterface,
  isCurrentAppSchema,
  CurrentAppConfiguration,
  AppCreationDefaultOptions,
} from '../models/app/app.js'
import {Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {
  getAppConfigurationFileName,
  getAppConfigurationShorthand,
  loadApp,
  loadAppConfiguration,
  loadAppName,
} from '../models/app/loader.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'

import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {TokenItem, renderConfirmationPrompt, renderInfo} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {getOrganization} from '@shopify/cli-kit/node/environment'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid Client ID: ${apiKey}`,
    tryMessage: outputContent`You can find the Client ID in the app settings in the Partners Dashboard.`,
  }
}

export interface DevContextOptions {
  directory: string
  apiKey?: string
  storeFqdn?: string
  reset: boolean
  developerPlatformClient: DeveloperPlatformClient
}

interface DevContextOutput {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string}
  remoteAppUpdated: boolean
  storeFqdn: string
  storeId: string
  updateURLs: boolean | undefined
  localApp: AppInterface
}

export interface GenerateContextOptions {
  appId?: string
  apiKey?: string
  directory: string
  reset: boolean
  developerPlatformClient: DeveloperPlatformClient
  configName?: string
}

/**
 * Make sure there is a valid context to execute `generate extension`
 *
 * We just need a valid app API key to access the Specifications API.
 * - If the API key is provided via flag, we use it.
 * - Else, if there is an API key in the current config or cache, we use it.
 * - Else, we prompt the user to select/create an app.
 *
 * The selection is then cached as the "dev" app for the current directory.
 */
export async function ensureGenerateContext(options: GenerateContextOptions): Promise<OrganizationApp> {
  const {appId, apiKey} = options
  let developerPlatformClient = options.developerPlatformClient
  if (apiKey) {
    const app = await appFromId({id: appId, apiKey, developerPlatformClient})
    if (!app) {
      const errorMessage = InvalidApiKeyErrorMessage(apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    await logMetadataForLoadedContext(app)
    return app
  }

  const {cachedInfo, remoteApp} = await getAppContext(options)
  developerPlatformClient = remoteApp?.developerPlatformClient ?? developerPlatformClient

  if (cachedInfo?.appId && cachedInfo?.orgId) {
    const org = await fetchOrgFromId(cachedInfo.orgId, developerPlatformClient)
    const app =
      remoteApp ||
      (await appFromId({
        id: cachedInfo.appGid,
        apiKey: cachedInfo.appId,
        organizationId: org.id,
        developerPlatformClient,
      }))
    if (!app || !org) {
      const errorMessage = InvalidApiKeyErrorMessage(cachedInfo.appId)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    showReusedGenerateValues(org.businessName, cachedInfo)
    await logMetadataForLoadedContext({
      organizationId: app.organizationId,
      apiKey: app.apiKey,
    })
    return app
  } else {
    let orgId = cachedInfo?.orgId
    if (!orgId) {
      const org = await selectOrg()
      developerPlatformClient = selectDeveloperPlatformClient({organization: org})
      orgId = org.id
    }

    const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(orgId)
    const localAppName = await loadAppName(options.directory)
    const selectedApp = await selectOrCreateApp(localAppName, apps, hasMorePages, organization, developerPlatformClient)
    setCachedAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      orgId,
    })
    await logMetadataForLoadedContext({
      organizationId: selectedApp.organizationId,
      apiKey: selectedApp.apiKey,
    })
    return selectedApp
  }
}

/**
 * Make sure there is a valid context to execute `dev`
 * That means we have a valid organization, app and dev store selected.
 *
 * If there are app/store from flags, we check if they are valid. If they are not, throw an error.
 * If there is info in the cache or current configuration, check if it is still valid and return it.
 * If there is no info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The info will be updated in the cache or current configuration
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureDevContext(options: DevContextOptions): Promise<DevContextOutput> {
  let developerPlatformClient = options.developerPlatformClient
  const {configuration, cachedInfo, remoteApp} = await getAppContext({
    ...options,
    promptLinkingApp: !options.apiKey,
  })
  developerPlatformClient = remoteApp?.developerPlatformClient ?? developerPlatformClient

  let orgId = getOrganization() || cachedInfo?.orgId
  if (!orgId) {
    const org = await selectOrg()
    developerPlatformClient = selectDeveloperPlatformClient({organization: org})
    orgId = org.id
  }

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, orgId, developerPlatformClient)
  const organization = await fetchOrgFromId(orgId, developerPlatformClient)

  if (!selectedApp || !selectedStore) {
    // if we have selected an app or a dev store from a command flag, we keep them
    // if not, we try to load the app or the dev store from the current config or cache
    // if that's not available, we prompt the user to choose an existing one or create a new one
    const [_selectedApp, _selectedStore] = await Promise.all([
      selectedApp ||
        remoteApp ||
        (cachedInfo?.appId &&
          appFromId({id: cachedInfo.appGid, apiKey: cachedInfo.appId, organizationId: orgId, developerPlatformClient})),
      selectedStore || (cachedInfo?.storeFqdn && storeFromFqdn(cachedInfo.storeFqdn, orgId, developerPlatformClient)),
    ])

    if (_selectedApp) {
      selectedApp = _selectedApp
    } else {
      const {apps, hasMorePages} = await developerPlatformClient.appsForOrg(orgId)
      // get toml names somewhere close to here
      const localAppName = await loadAppName(options.directory)
      selectedApp = await selectOrCreateApp(localAppName, apps, hasMorePages, organization, developerPlatformClient)
    }

    if (_selectedStore) {
      selectedStore = _selectedStore
    } else {
      const allStores = await developerPlatformClient.devStoresForOrg(orgId)
      selectedStore = await selectStore(allStores, organization, developerPlatformClient)
    }
  }

  const specifications = await fetchSpecifications({developerPlatformClient, app: selectedApp})

  selectedApp = {
    ...selectedApp,
    configuration: await fetchAppRemoteConfiguration(
      selectedApp,
      developerPlatformClient,
      specifications,
      selectedApp.flags,
    ),
  }

  const localApp = await loadApp({
    directory: options.directory,
    specifications,
    userProvidedConfigName: getAppConfigurationShorthand(configuration.path),
    remoteFlags: selectedApp.flags,
  })

  // We only update the cache or config if the current app is the right one
  const rightApp = selectedApp.apiKey === cachedInfo?.appId
  if (isCurrentAppSchema(configuration) && rightApp) {
    if (cachedInfo) cachedInfo.storeFqdn = selectedStore?.shopDomain
    const newConfiguration = {
      ...configuration,
      build: {
        ...configuration.build,
        dev_store_url: selectedStore?.shopDomain,
      },
    }
    localApp.configuration = newConfiguration
    await writeAppConfigurationFile(newConfiguration, localApp.configSchema)
  } else if (!cachedInfo || rightApp) {
    setCachedAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      storeFqdn: selectedStore?.shopDomain,
      orgId,
    })
  }

  showReusedDevValues({
    selectedApp,
    selectedStore,
    cachedInfo,
    organization,
  })

  const result = buildOutput(selectedApp, selectedStore, localApp, cachedInfo)
  await logMetadataForLoadedContext({
    organizationId: result.remoteApp.organizationId,
    apiKey: result.remoteApp.apiKey,
  })
  return result
}

const resetHelpMessage = ['You can pass', {command: '--reset'}, 'to your command to reset your app configuration.']

interface AppFromIdOptions {
  apiKey: string
  id?: string
  organizationId?: string
  developerPlatformClient: DeveloperPlatformClient
}

export const appFromId = async (options: AppFromIdOptions): Promise<OrganizationApp> => {
  let organizationId = options.organizationId
  let developerPlatformClient = options.developerPlatformClient
  if (!organizationId) {
    organizationId = '0'
    if (developerPlatformClient.requiresOrganization) {
      const org = await selectOrg()
      developerPlatformClient = selectDeveloperPlatformClient({organization: org})
      organizationId = org.id
    }
  }
  const app = await developerPlatformClient.appFromId({
    id: options.id ?? 'no-id-available',
    apiKey: options.apiKey,
    organizationId,
  })
  if (!app) throw new AbortError([`Couldn't find the app with Client ID`, {command: options.apiKey}], resetHelpMessage)
  return app
}

const storeFromFqdn = async (
  storeFqdn: string,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore> => {
  return {
    shopId: '1',
    link: 'string',
    shopDomain: storeFqdn,
    shopName: 'name',
    transferDisabled: true,
    convertableToPartnerTest: true,
  }
  // const result = await fetchStoreByDomain(orgId, storeFqdn, developerPlatformClient)
  // if (result?.store) {
  //   // never automatically convert a store provided via the cache
  //   await convertToTransferDisabledStoreIfNeeded(result.store, orgId, developerPlatformClient, 'never')
  //   return result.store
  // } else {
  //   throw new AbortError(`Couldn't find the store with domain "${storeFqdn}".`, resetHelpMessage)
  // }
}

function buildOutput(
  app: OrganizationApp,
  store: OrganizationStore,
  localApp: AppInterface,
  cachedInfo?: CachedAppInfo,
): DevContextOutput {
  return {
    remoteApp: {
      ...app,
      apiSecret: app.apiSecretKeys.length === 0 ? undefined : app.apiSecretKeys[0]!.secret,
    },
    remoteAppUpdated: app.apiKey !== cachedInfo?.previousAppId,
    storeFqdn: store.shopDomain,
    storeId: store.shopId,
    updateURLs: cachedInfo?.updateURLs,
    localApp,
  }
}

interface ReleaseContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
  developerPlatformClient?: DeveloperPlatformClient
}

interface ReleaseContextOutput {
  developerPlatformClient: DeveloperPlatformClient
  app: AppInterface
  remoteApp: OrganizationApp
}

interface DeployContextOutput {
  app: AppInterface
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'>
  identifiers: Identifiers
  release: boolean
}

/**
 * If there is a cached ApiKey used for dev, retrieve that and ask the user if they want to reuse it
 * @param app - The local app object
 * @param developerPlatformClient - The client to access the platform API
 * @returns
 * OrganizationApp if a cached value is valid.
 * undefined if there is no cached value or the user doesn't want to use it.
 */
async function fetchDevAppAndPrompt(
  app: AppInterface,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationApp | undefined> {
  const cachedInfo = getCachedAppInfo(app.directory)
  const devAppId = cachedInfo?.appId
  if (!devAppId) return undefined

  const remoteApp = await appFromId({
    apiKey: devAppId,
    id: cachedInfo.appGid,
    organizationId: cachedInfo.orgId ?? '0',
    developerPlatformClient,
  })
  if (!remoteApp) return undefined

  const org = await fetchOrgFromId(remoteApp.organizationId, remoteApp.developerPlatformClient!)

  showDevValues(org.businessName ?? 'unknown', remoteApp.title)
  const reuse = await reuseDevConfigPrompt()
  return reuse ? remoteApp : undefined
}

export async function ensureThemeExtensionDevContext(
  extension: ExtensionInstance,
  apiKey: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<ExtensionRegistration> {
  const remoteSpecifications = await developerPlatformClient.appExtensionRegistrations({
    id: apiKey,
    apiKey,
    organizationId: '1',
  })
  const remoteRegistrations = remoteSpecifications.app.extensionRegistrations.filter((extension) => {
    return extension.type === 'THEME_APP_EXTENSION'
  })

  if (remoteRegistrations.length > 0) {
    return remoteRegistrations[0]!
  }

  const registration = await createExtension(apiKey, extension.graphQLType, extension.handle, developerPlatformClient)

  return registration
}

export interface DeployContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
  noRelease: boolean
  commitReference?: string
  developerPlatformClient: DeveloperPlatformClient
}

/**
 * Make sure there is a valid context to execute `deploy`
 * That means we have a valid session, organization and app.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected org, app and dev store
 */
export async function ensureDeployContext(options: DeployContextOptions): Promise<DeployContextOutput> {
  const {reset, force, noRelease} = options
  let developerPlatformClient = options.developerPlatformClient
  const [remoteApp] = await fetchAppAndIdentifiers(options, developerPlatformClient)
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})
  const app: AppInterface = await loadApp({
    specifications,
    directory: options.app.directory,
    userProvidedConfigName: getAppConfigurationShorthand(options.app.configuration.path),
    remoteFlags: remoteApp.flags,
  })

  const org = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  await ensureIncludeConfigOnDeploy({org, app, remoteApp, reset, force})

  const identifiers = await ensureDeploymentIdsPresence({
    app,
    appId: remoteApp.apiKey,
    appName: remoteApp.title,
    force,
    release: !noRelease,
    developerPlatformClient,
    envIdentifiers: getAppIdentifiers({app}, developerPlatformClient),
    remoteApp,
  })

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient}),
  }

  const result: DeployContextOutput = {
    app: options.app,
    remoteApp: {
      id: remoteApp.id,
      apiKey: remoteApp.apiKey,
      title: remoteApp.title,
      appType: remoteApp.appType,
      organizationId: remoteApp.organizationId,
      grantedScopes: remoteApp.grantedScopes,
      flags: remoteApp.flags,
      developerPlatformClient,
    },
    identifiers,
    release: !noRelease,
  }

  await logMetadataForLoadedContext({
    organizationId: result.remoteApp.organizationId,
    apiKey: result.identifiers.app,
  })
  return result
}
interface ShouldOrPromptIncludeConfigDeployOptions {
  appDirectory: string
  localApp: AppInterface
}

async function ensureIncludeConfigOnDeploy({
  org,
  app,
  remoteApp,
  reset,
  force,
}: {
  org: Organization
  app: AppInterface
  remoteApp: OrganizationApp
  reset: boolean
  force: boolean
}) {
  let previousIncludeConfigOnDeploy = app.includeConfigOnDeploy
  if (reset) previousIncludeConfigOnDeploy = undefined
  if (force) previousIncludeConfigOnDeploy = previousIncludeConfigOnDeploy ?? false

  renderCurrentlyUsedConfigInfo({
    org: org.businessName,
    appName: remoteApp.title,
    appDotEnv: app.dotenv?.path,
    configFile: isCurrentAppSchema(app.configuration) ? basename(app.configuration.path) : undefined,
    resetMessage: resetHelpMessage,
    includeConfigOnDeploy: previousIncludeConfigOnDeploy,
  })

  if (force || previousIncludeConfigOnDeploy !== undefined) return
  await promptIncludeConfigOnDeploy({
    appDirectory: app.directory,
    localApp: app,
  })
}

async function promptIncludeConfigOnDeploy(options: ShouldOrPromptIncludeConfigDeployOptions) {
  const shouldIncludeConfigDeploy = await includeConfigOnDeployPrompt(options.localApp.configuration.path)
  const localConfiguration = options.localApp.configuration as CurrentAppConfiguration
  localConfiguration.build = {
    ...localConfiguration.build,
    include_config_on_deploy: shouldIncludeConfigDeploy,
  }

  await writeAppConfigurationFile(localConfiguration, options.localApp.configSchema)

  await metadata.addPublicMetadata(() => ({cmd_deploy_confirm_include_config_used: shouldIncludeConfigDeploy}))
}

function includeConfigOnDeployPrompt(configPath: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Include \`${basename(configPath)}\` configuration on \`deploy\`?`,
    confirmationMessage: 'Yes, always (Recommended)',
    cancellationMessage: 'No, never',
  })
}

/**
 * Make sure there is a valid context to execute `release`
 * That means we have a valid session, organization and app.
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 * Finally, the info is updated in the env file.
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureReleaseContext(options: ReleaseContextOptions): Promise<ReleaseContextOutput> {
  let developerPlatformClient =
    options.developerPlatformClient ?? selectDeveloperPlatformClient({configuration: options.app.configuration})
  const [remoteApp, envIdentifiers] = await fetchAppAndIdentifiers(options, developerPlatformClient)
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient
  const identifiers: Identifiers = envIdentifiers as Identifiers

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app: options.app, identifiers, command: 'release', developerPlatformClient}),
  }
  const result = {
    app: options.app,
    apiKey: remoteApp.apiKey,
    remoteApp,
    developerPlatformClient,
  }

  await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})
  return result
}

interface VersionListContextOptions {
  app: AppInterface
  apiKey?: string
  reset: false
  developerPlatformClient?: DeveloperPlatformClient
}

interface VersionsListContextOutput {
  developerPlatformClient: DeveloperPlatformClient
  remoteApp: OrganizationApp
}

/**
 * Make sure there is a valid context to execute `versions list`
 *
 * If there is an API key via flag, configuration or env file, we check if it is valid. Otherwise, throw an error.
 * If there is no API key (or is invalid), show prompts to select an org and app.
 *
 * @param options - Current dev context options
 * @returns The Developer Platform client and the app
 */
export async function ensureVersionsListContext(
  options: VersionListContextOptions,
): Promise<VersionsListContextOutput> {
  let developerPlatformClient =
    options.developerPlatformClient ?? selectDeveloperPlatformClient({configuration: options.app.configuration})
  const [remoteApp] = await fetchAppAndIdentifiers(options, developerPlatformClient)
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})
  return {
    developerPlatformClient,
    remoteApp,
  }
}

export async function fetchOrCreateOrganizationApp(
  options: AppCreationDefaultOptions,
  directory?: string,
): Promise<OrganizationApp> {
  const {isLaunchable, scopesArray, name} = options
  const org = await selectOrg()
  const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
  const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
  const remoteApp = await selectOrCreateApp(name, apps, hasMorePages, organization, developerPlatformClient, {
    isLaunchable,
    scopesArray,
    directory,
  })
  remoteApp.developerPlatformClient = developerPlatformClient

  await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})

  return remoteApp
}

export async function fetchAppAndIdentifiers(
  options: {
    app: AppInterface
    reset: boolean
    apiKey?: string
  },
  developerPlatformClient: DeveloperPlatformClient,
  reuseFromDev = true,
): Promise<[OrganizationApp, Partial<UuidOnlyIdentifiers>]> {
  const app = options.app
  let reuseDevCache = reuseFromDev
  let envIdentifiers = getAppIdentifiers({app}, developerPlatformClient)
  let remoteApp: OrganizationApp | undefined

  if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
    reuseDevCache = false
    const configuration = await link({directory: app.directory, developerPlatformClient})
    app.configuration = configuration
  }

  if (isCurrentAppSchema(app.configuration)) {
    const apiKey = options.apiKey ?? app.configuration.client_id
    const appGid = app.configuration.app_id
    remoteApp = await appFromId({
      id: appGid,
      apiKey,
      organizationId: app.configuration.organization_id,
      developerPlatformClient,
    })
  } else if (options.apiKey) {
    remoteApp = await appFromId({apiKey: options.apiKey, developerPlatformClient})
  } else if (envIdentifiers.app) {
    remoteApp = await appFromId({apiKey: envIdentifiers.app, developerPlatformClient})
  } else if (reuseDevCache) {
    remoteApp = await fetchDevAppAndPrompt(app, developerPlatformClient)
  }

  if (!remoteApp) {
    remoteApp = await fetchOrCreateOrganizationApp(app.creationDefaultOptions())
  }

  await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})

  return [remoteApp, envIdentifiers]
}

/**
 * Any data sent via input flags takes precedence and needs to be validated.
 * If any of the inputs is invalid, we must throw an error and stop the execution.
 */
async function fetchDevDataFromOptions(
  options: DevContextOptions,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<{app?: OrganizationApp; store?: OrganizationStore}> {
  const [selectedApp, orgWithStore] = await Promise.all([
    (async () => {
      let selectedApp: OrganizationApp | undefined
      if (options.apiKey) {
        selectedApp = await appFromId({apiKey: options.apiKey, developerPlatformClient})
        if (!selectedApp) {
          const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
          throw new AbortError(errorMessage.message, errorMessage.tryMessage)
        }
        return selectedApp
      }
    })(),
    (async () => {
      // if (options.storeFqdn && false) {
      //   const orgWithStore = await fetchStoreByDomain(orgId, options.storeFqdn, developerPlatformClient)
      //   if (!orgWithStore) throw new AbortError(`Could not find Organization for id ${orgId}.`)
      //   if (!orgWithStore.store) {
      //     const partners = await partnersFqdn()
      //     const org = orgWithStore.organization
      //     throw new AbortError(
      //       `Could not find ${options.storeFqdn} in the Organization ${org.businessName} as a valid store.`,
      //       `Visit https://${partners}/${org.id}/stores to create a new development or Shopify Plus sandbox store in your organization`,
      //     )
      //   }
      //   return orgWithStore as {store: OrganizationStore; organization: Organization}
      // }
    })(),
  ])
  let selectedStore: OrganizationStore | undefined

  if (options.storeFqdn) {
    // selectedStore = orgWithStore!.store
    // // never automatically convert a store provided via the command line
    // await convertToTransferDisabledStoreIfNeeded(
    //   selectedStore,
    //   orgWithStore!.organization.id,
    //   developerPlatformClient,
    //   'never',
    // )

    selectedStore = {
      shopId: '1',
      link: 'string',
      shopDomain: options.storeFqdn,
      shopName: 'name',
      transferDisabled: true,
      convertableToPartnerTest: true,
    }
  }

  return {app: selectedApp, store: selectedStore}
}

interface AppContext {
  configuration: AppConfiguration
  cachedInfo?: CachedAppInfo
  remoteApp?: OrganizationApp
}

/**
 * Retrieve app info from the cache or the current configuration.
 *
 * @param reset - Whether to reset the cache or not.
 * @param directory - The directory containing the app.
 * @param developerPlatformClient - The client to access the platform API
 */
export async function getAppContext({
  reset,
  directory,
  developerPlatformClient,
  configName,
  promptLinkingApp = true,
}: {
  reset: boolean
  directory: string
  developerPlatformClient: DeveloperPlatformClient
  configName?: string
  promptLinkingApp?: boolean
}): Promise<AppContext> {
  const previousCachedInfo = getCachedAppInfo(directory)

  if (reset) clearCachedAppInfo(directory)

  const firstTimeSetup = previousCachedInfo === undefined
  const usingConfigAndResetting = previousCachedInfo?.configFile && reset
  const usingConfigWithNoTomls =
    previousCachedInfo?.configFile && (await glob(joinPath(directory, 'shopify.app*.toml'))).length === 0

  if (promptLinkingApp && (firstTimeSetup || usingConfigAndResetting || usingConfigWithNoTomls)) {
    await link({directory, baseConfigName: previousCachedInfo?.configFile}, false)
  }

  let cachedInfo = getCachedAppInfo(directory)

  const {configuration} = await loadAppConfiguration({
    directory,
    userProvidedConfigName: configName,
  })

  let remoteApp
  if (isCurrentAppSchema(configuration)) {
    remoteApp = await appFromId({
      apiKey: configuration.client_id,
      id: configuration.app_id,
      organizationId: configuration.organization_id,
      developerPlatformClient,
    })
    cachedInfo = {
      ...cachedInfo,
      directory,
      configFile: basename(configuration.path),
      orgId: remoteApp.organizationId,
      appId: remoteApp.apiKey,
      title: remoteApp.title,
      storeFqdn: configuration.build?.dev_store_url,
      updateURLs: configuration.build?.automatically_update_urls_on_dev,
    }

    await logMetadataForLoadedContext({organizationId: remoteApp.organizationId, apiKey: remoteApp.apiKey})
  }

  return {
    configuration,
    cachedInfo,
    remoteApp,
  }
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected organization ID
 */
export async function selectOrg(): Promise<Organization> {
  const orgs = await fetchOrganizations()
  const org = await selectOrganizationPrompt(orgs)
  return org
}

interface ReusedValuesOptions {
  organization: Organization
  selectedApp: OrganizationApp
  selectedStore: OrganizationStore
  cachedInfo?: CachedAppInfo
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 */
function showReusedDevValues({organization, selectedApp, selectedStore, cachedInfo}: ReusedValuesOptions) {
  if (!cachedInfo) return

  let updateURLs = 'Not yet configured'
  if (cachedInfo.updateURLs !== undefined) updateURLs = cachedInfo.updateURLs ? 'Yes' : 'No'

  renderCurrentlyUsedConfigInfo({
    org: organization.businessName,
    appName: selectedApp.title,
    devStore: selectedStore.shopDomain,
    updateURLs,
    configFile: cachedInfo.configFile,
    resetMessage: resetHelpMessage,
  })
}

interface CurrentlyUsedConfigInfoOptions {
  appName: string
  org?: string
  devStore?: string
  updateURLs?: string
  configFile?: string
  appDotEnv?: string
  includeConfigOnDeploy?: boolean
  resetMessage?: (
    | string
    | {
        command: string
      }
  )[]
}

export function renderCurrentlyUsedConfigInfo({
  org,
  appName,
  devStore,
  updateURLs,
  configFile,
  appDotEnv,
  resetMessage,
  includeConfigOnDeploy,
}: CurrentlyUsedConfigInfoOptions): void {
  const items = [`App:             ${appName}`]

  if (org) items.unshift(`Org:             ${org}`)
  if (devStore) items.push(`Dev store:       ${devStore}`)
  if (updateURLs) items.push(`Update URLs:     ${updateURLs}`)
  if (includeConfigOnDeploy !== undefined) items.push(`Include config:  ${includeConfigOnDeploy ? 'Yes' : 'No'}`)

  let body: TokenItem = [{list: {items}}]
  if (resetMessage) body = [...body, '\n', ...resetMessage]

  const fileName = (appDotEnv && basename(appDotEnv)) || (configFile && getAppConfigurationFileName(configFile))

  renderInfo({
    headline: configFile ? `Using ${fileName}:` : 'Using these settings:',
    body,
  })
}

function showReusedGenerateValues(org: string, cachedAppInfo: CachedAppInfo) {
  renderCurrentlyUsedConfigInfo({
    org,
    appName: cachedAppInfo.title!,
    configFile: cachedAppInfo.configFile,
    resetMessage: resetHelpMessage,
  })
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org - Organization name
 * @param app - App name
 * @param store - Store domain
 */
function showDevValues(org: string, appName: string) {
  renderInfo({
    headline: 'Your configs for dev were:',
    body: {
      list: {
        items: [`Org:        ${org}`, `App:        ${appName}`],
      },
    },
  })
}

export async function logMetadataForLoadedContext(app: {organizationId: string; apiKey: string}) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(app.organizationId),
    api_key: app.apiKey,
  }))
}

export async function enableDeveloperPreview({
  apiKey,
  developerPlatformClient,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
}) {
  return developerPreviewUpdate({apiKey, developerPlatformClient, enabled: true})
}

export async function disableDeveloperPreview({
  apiKey,
  developerPlatformClient,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
}) {
  await developerPreviewUpdate({apiKey, developerPlatformClient, enabled: false})
}

export async function developerPreviewUpdate({
  apiKey,
  developerPlatformClient,
  enabled,
}: {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
  enabled: boolean
}) {
  const input: DevelopmentStorePreviewUpdateInput = {
    input: {
      apiKey,
      enabled,
    },
  }
  const result: DevelopmentStorePreviewUpdateSchema = await developerPlatformClient.updateDeveloperPreview(input)
  const userErrors = result.developmentStorePreviewUpdate.userErrors
  return !userErrors || userErrors.length === 0
}

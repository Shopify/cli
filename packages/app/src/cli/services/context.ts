import {selectOrCreateApp} from './dev/select-app.js'
import {
  fetchAllDevStores,
  fetchAppFromApiKey,
  fetchOrgAndApps,
  fetchOrganizations,
  fetchOrgFromId,
  fetchStoreByDomain,
  FetchResponse,
  fetchAppExtensionRegistrations,
} from './dev/fetch.js'
import {convertToTestStoreIfNeeded, selectStore} from './dev/select-store.js'
import {ensureDeploymentIdsPresence} from './context/identifiers.js'
import {createExtension, ExtensionRegistration} from './dev/create-extension.js'
import {CachedAppInfo, clearAppInfo, getAppInfo, setAppInfo} from './local-storage.js'
import {reuseDevConfigPrompt, selectOrganizationPrompt} from '../prompts/dev.js'
import {AppInterface} from '../models/app/app.js'
import {Identifiers, UuidOnlyIdentifiers, updateAppIdentifiers, getAppIdentifiers} from '../models/app/identifiers.js'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'
import metadata from '../metadata.js'
import {ThemeExtension} from '../models/app/extensions.js'
import {loadAppName} from '../models/app/loader.js'
import {getPackageManager, PackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderInfo, renderTasks} from '@shopify/cli-kit/node/ui'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {outputContent, outputInfo, outputToken, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {getOrganization} from '@shopify/cli-kit/node/environment'

export const InvalidApiKeyErrorMessage = (apiKey: string) => {
  return {
    message: outputContent`Invalid API key: ${apiKey}`,
    tryMessage: outputContent`You can find the API key in the app settings in the Partners Dashboard.`,
  }
}

export interface DevContextOptions {
  directory: string
  apiKey?: string
  storeFqdn?: string
  reset: boolean
}

interface DevContextOutput {
  remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string}
  remoteAppUpdated: boolean
  storeFqdn: string
  updateURLs: boolean | undefined
  useCloudflareTunnels: boolean
}

/**
 * Make sure there is a valid context to execute `generate extension`
 *
 * We just need a valid app API key to access the Specifications API.
 * - If the API key is provided via flag, we use it.
 * - Else, if there is cached API key for the current directory, we use it.
 * - Else, we prompt the user to select/create an app.
 *
 * The selection is then cached as the "dev" app for the current directory.
 */
export async function ensureGenerateContext(options: {
  apiKey?: string
  directory: string
  reset: boolean
  token: string
}): Promise<string> {
  if (options.apiKey) {
    const app = await fetchAppFromApiKey(options.apiKey, options.token)
    if (!app) {
      const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    return app.apiKey
  }
  const cachedInfo = getAppDevCachedInfo({reset: options.reset, directory: options.directory})

  if (cachedInfo === undefined && !options.reset) {
    const explanation =
      `\nLooks like this is the first time you're running 'generate extension' for this project.\n` +
      'Configure your preferences by answering a few questions.\n'
    outputInfo(explanation)
  }

  if (cachedInfo?.appId && cachedInfo?.orgId) {
    const org = await fetchOrgFromId(cachedInfo.orgId, options.token)
    const app = await fetchAppFromApiKey(cachedInfo.appId, options.token)
    if (!app || !org) {
      const errorMessage = InvalidApiKeyErrorMessage(cachedInfo.appId)
      throw new AbortError(errorMessage.message, errorMessage.tryMessage)
    }
    const packageManager = await getPackageManager(options.directory)
    showGenerateReusedValues(org.businessName, cachedInfo, packageManager)
    return app.apiKey
  } else {
    const orgId = cachedInfo?.orgId || (await selectOrg(options.token))
    const {organization, apps} = await fetchOrgAndApps(orgId, options.token)
    const localAppName = await loadAppName(options.directory)
    const selectedApp = await selectOrCreateApp(localAppName, apps, organization, options.token)
    setAppInfo({
      appId: selectedApp.apiKey,
      title: selectedApp.title,
      directory: options.directory,
      orgId,
    })
    return selectedApp.apiKey
  }
}

/**
 * Make sure there is a valid context to execute `dev`
 * That means we have a valid organization, app and dev store selected.
 *
 * If there are app/store from flags, we check if they are valid. If they are not, throw an error.
 * If there is cached info (user ran `dev` previously), check if it is still valid and return it.
 * If there is no cached info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The new selection will be saved as global configuration
 *  - The `shopify.app.toml` file will be updated with the new app apiKey
 *
 * @param options - Current dev context options
 * @returns The selected org, app and dev store
 */
export async function ensureDevContext(options: DevContextOptions, token: string): Promise<DevContextOutput> {
  const cachedInfo = getAppDevCachedInfo({
    reset: options.reset,
    directory: options.directory,
  })

  if (cachedInfo === undefined && !options.reset) {
    const explanation =
      `\nLooks like this is the first time you're running dev for this project.\n` +
      'Configure your preferences by answering a few questions.\n'
    outputInfo(explanation)
  }

  const orgId = getOrganization() || cachedInfo?.orgId || (await selectOrg(token))

  let {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(options, orgId, token)
  const organization = await fetchOrgFromId(orgId, token)
  const useCloudflareTunnels = organization.betas?.cliTunnelAlternative !== true

  if (selectedApp && selectedStore) {
    setAppInfo({
      appId: selectedApp.apiKey,
      directory: options.directory,
      storeFqdn: selectedStore.shopDomain,
      orgId,
    })

    return buildOutput(selectedApp, selectedStore, useCloudflareTunnels, cachedInfo)
  }

  const [_selectedApp, _selectedStore] = await Promise.all([
    selectedApp ? selectedApp : appFromId(cachedInfo?.appId, token),
    selectedStore ? selectedStore : storeFromFqdn(cachedInfo?.storeFqdn, orgId, token),
  ])

  if (_selectedApp) {
    selectedApp = _selectedApp
  } else {
    const {apps} = await fetchOrgAndApps(orgId, token)
    const localAppName = await loadAppName(options.directory)
    selectedApp = await selectOrCreateApp(localAppName, apps, organization, token)
  }

  if (_selectedStore) {
    selectedStore = _selectedStore
  } else {
    const allStores = await fetchAllDevStores(orgId, token)
    selectedStore = await selectStore(allStores, organization, token)
  }

  setAppInfo({
    appId: selectedApp.apiKey,
    title: selectedApp.title,
    directory: options.directory,
    storeFqdn: selectedStore?.shopDomain,
    orgId,
  })

  if (selectedApp.apiKey === cachedInfo?.appId && selectedStore.shopDomain === cachedInfo.storeFqdn) {
    const packageManager = await getPackageManager(options.directory)
    showReusedValues(organization.businessName, cachedInfo, packageManager)
  }

  const result = buildOutput(selectedApp, selectedStore, useCloudflareTunnels, cachedInfo)
  await logMetadataForLoadedDevContext(result)
  return result
}

const resetHelpMessage = 'You can pass `--reset` to your command to reset your config.'

const appFromId = async (appId: string | undefined, token: string): Promise<OrganizationApp | undefined> => {
  if (!appId) return
  const app = await fetchAppFromApiKey(appId, token)
  if (!app) throw new BugError(`Couldn't find the app with API key "${appId}". ${resetHelpMessage}`)
  return app
}

const storeFromFqdn = async (
  storeFqdn: string | undefined,
  orgId: string,
  token: string,
): Promise<OrganizationStore | undefined> => {
  if (!storeFqdn) return
  const result = await fetchStoreByDomain(orgId, token, storeFqdn)
  if (result?.store) {
    await convertToTestStoreIfNeeded(result.store, orgId, token)
    return result.store
  } else {
    throw new BugError(`Couldn't find the store with domain "${storeFqdn}". ${resetHelpMessage}`)
  }
}

function buildOutput(
  app: OrganizationApp,
  store: OrganizationStore,
  useCloudflareTunnels: boolean,
  cachedInfo?: CachedAppInfo,
): DevContextOutput {
  return {
    remoteApp: {
      ...app,
      apiSecret: app.apiSecretKeys.length === 0 ? undefined : app.apiSecretKeys[0]!.secret,
    },
    remoteAppUpdated: app.apiKey !== cachedInfo?.appId,
    storeFqdn: store.shopDomain,
    updateURLs: cachedInfo?.updateURLs,
    useCloudflareTunnels,
  }
}

export interface DeployContextOptions {
  app: AppInterface
  apiKey?: string
  reset: boolean
  force: boolean
}

interface DeployContextOutput {
  app: AppInterface
  token: string
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
}

/**
 * If there is a cached ApiKey used for dev, retrieve that and ask the user if they want to reuse it
 * @param app - The local app object
 * @param token - The token to use to access the Partners API
 * @returns
 * OrganizationApp if a cached value is valid.
 * undefined if there is no cached value or the user doesn't want to use it.
 */
export async function fetchDevAppAndPrompt(app: AppInterface, token: string): Promise<OrganizationApp | undefined> {
  const devAppId = getAppInfo(app.directory)?.appId
  if (!devAppId) return undefined

  const partnersResponse = await fetchAppFromApiKey(devAppId, token)
  if (!partnersResponse) return undefined

  const org = await fetchOrgFromId(partnersResponse.organizationId, token)

  showDevValues(org.businessName ?? 'unknown', partnersResponse.title)
  const reuse = await reuseDevConfigPrompt()
  return reuse ? partnersResponse : undefined
}

export async function ensureThemeExtensionDevContext(
  extension: ThemeExtension,
  apiKey: string,
  token: string,
): Promise<ExtensionRegistration> {
  const remoteSpecifications = await fetchAppExtensionRegistrations({token, apiKey})
  const remoteRegistrations = remoteSpecifications.app.extensionRegistrations.filter((extension) => {
    return extension.type === 'THEME_APP_EXTENSION'
  })

  if (remoteRegistrations.length > 0) {
    return remoteRegistrations[0]!
  }

  const registration = await createExtension(apiKey, extension.graphQLType, extension.localIdentifier, token)

  return registration
}

export async function ensureDeployContext(options: DeployContextOptions): Promise<DeployContextOutput> {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)

  let identifiers: Identifiers = envIdentifiers as Identifiers

  identifiers = await ensureDeploymentIdsPresence({
    app: options.app,
    appId: partnersApp.apiKey,
    appName: partnersApp.title,
    force: options.force,
    token,
    envIdentifiers,
    partnersApp,
  })

  // eslint-disable-next-line no-param-reassign
  options = {
    ...options,
    app: await updateAppIdentifiers({app: options.app, identifiers, command: 'deploy'}),
  }
  const result = {
    app: options.app,
    partnersApp: {
      id: partnersApp.id,
      title: partnersApp.title,
      appType: partnersApp.appType,
      organizationId: partnersApp.organizationId,
      grantedScopes: partnersApp.grantedScopes,
      betas: partnersApp.betas,
    },
    identifiers,
    token,
  }

  await logMetadataForLoadedDeployContext(result)
  return result
}

export async function fetchOrCreateOrganizationApp(app: AppInterface, token: string): Promise<OrganizationApp> {
  const orgId = await selectOrg(token)
  const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
  const partnersApp = await selectOrCreateApp(app.name, apps, organization, token)
  return partnersApp
}

export async function fetchAppAndIdentifiers(
  options: {
    app: AppInterface
    reset: boolean
    packageManager?: PackageManager
    apiKey?: string
  },
  token: string,
): Promise<[OrganizationApp, Partial<UuidOnlyIdentifiers>]> {
  let envIdentifiers = getAppIdentifiers({app: options.app})
  let partnersApp: OrganizationApp | undefined

  if (options.reset) {
    envIdentifiers = {app: undefined, extensions: {}}
  } else if (envIdentifiers.app) {
    const apiKey = options.apiKey ?? envIdentifiers.app
    partnersApp = await fetchAppFromApiKey(apiKey, token)
    if (!partnersApp) {
      throw new AbortError(
        outputContent`Couldn't find the app with API key ${apiKey}`,
        outputContent`• If you didn't intend to select this app, run ${
          outputContent`${outputToken.packagejsonScript(options.app.packageManager, 'deploy', '--reset')}`.value
        }`,
      )
    }
  } else {
    partnersApp = await fetchDevAppAndPrompt(options.app, token)
  }

  if (!partnersApp) {
    partnersApp = await fetchOrCreateOrganizationApp(options.app, token)
  }

  return [partnersApp, envIdentifiers]
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data = {} as FetchResponse
  const tasks = [
    {
      title: 'Fetching organization data',
      task: async () => {
        const organizationAndApps = await fetchOrgAndApps(orgId, token)
        const stores = await fetchAllDevStores(orgId, token)
        data = {...organizationAndApps, stores} as FetchResponse
        // We need ALL stores so we can validate the selected one.
        // This is a temporary workaround until we have an endpoint to fetch only 1 store to validate.
      },
    },
  ]
  await renderTasks(tasks)
  return data
}

/**
 * Any data sent via input flags takes precedence and needs to be validated.
 * If any of the inputs is invalid, we must throw an error and stop the execution.
 */
async function fetchDevDataFromOptions(
  options: DevContextOptions,
  orgId: string,
  token: string,
): Promise<{app?: OrganizationApp; store?: OrganizationStore}> {
  const [selectedApp, orgWithStore] = await Promise.all([
    (async () => {
      let selectedApp: OrganizationApp | undefined
      if (options.apiKey) {
        selectedApp = await fetchAppFromApiKey(options.apiKey, token)
        if (!selectedApp) {
          const errorMessage = InvalidApiKeyErrorMessage(options.apiKey)
          throw new AbortError(errorMessage.message, errorMessage.tryMessage)
        }
        return selectedApp
      }
    })(),
    (async () => {
      if (options.storeFqdn) {
        const orgWithStore = await fetchStoreByDomain(orgId, token, options.storeFqdn)
        if (!orgWithStore) throw new BugError(`Could not find Organization for id ${orgId}.`)
        if (!orgWithStore.store) {
          const partners = await partnersFqdn()
          const org = orgWithStore.organization
          throw new BugError(
            `Could not find ${options.storeFqdn} in the Organization ${org.businessName} as a valid store.`,
            `Visit https://${partners}/${org.id}/stores to create a new development or Shopify Plus sandbox store in your organization`,
          )
        }
        return orgWithStore as {store: OrganizationStore; organization: Organization}
      }
    })(),
  ])
  let selectedStore: OrganizationStore | undefined

  if (options.storeFqdn) {
    selectedStore = orgWithStore!.store
    await convertToTestStoreIfNeeded(selectedStore, orgWithStore!.organization.id, token)
  }

  return {app: selectedApp, store: selectedStore}
}

/**
 * Retrieve cached info from the global configuration based on the current local app
 * @param reset - Whether to reset the cache or not
 * @param directory - The directory containing the app.
 */
function getAppDevCachedInfo({reset, directory}: {reset: boolean; directory: string}): CachedAppInfo | undefined {
  if (reset) clearAppInfo(directory)
  return getAppInfo(directory)
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param token - Token to access partners API
 * @returns The selected organization ID
 */
async function selectOrg(token: string): Promise<string> {
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  return org.id
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org - Organization name
 * @param app - App name
 * @param store - Store domain
 */
function showReusedValues(org: string, cachedAppInfo: CachedAppInfo, packageManager: PackageManager): void {
  let updateURLs = 'Not yet configured'
  if (cachedAppInfo.updateURLs !== undefined) updateURLs = cachedAppInfo.updateURLs ? 'Always' : 'Never'

  const items = [
    `Org:          ${org}`,
    `App:          ${cachedAppInfo.title}`,
    `Dev store:    ${cachedAppInfo.storeFqdn}`,
    `Update URLs:  ${updateURLs}`,
  ]

  if (cachedAppInfo.tunnelPlugin) items.push(`Tunnel:       ${cachedAppInfo.tunnelPlugin}`)

  renderInfo({
    headline: 'Using your previous dev settings:',
    body: [
      {
        list: {
          items,
        },
      },
      '\nTo reset your default dev config, run',
      {command: formatPackageManagerCommand(packageManager, 'dev', '--reset')},
    ],
  })
}

function showGenerateReusedValues(org: string, cachedAppInfo: CachedAppInfo, packageManager: PackageManager) {
  renderInfo({
    headline: 'Using your previous dev settings:',
    body: [
      {
        list: {
          items: [`Org:          ${org}`, `App:          ${cachedAppInfo.title}`],
        },
      },
      '\nTo reset your default dev config, run',
      {command: formatPackageManagerCommand(packageManager, 'dev', '--reset')},
    ],
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

async function logMetadataForLoadedDevContext(env: DevContextOutput) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(env.remoteApp.organizationId),
    api_key: env.remoteApp.apiKey,
  }))
}

async function logMetadataForLoadedDeployContext(env: DeployContextOutput) {
  await metadata.addPublicMetadata(() => ({
    partner_id: tryParseInt(env.partnersApp.organizationId),
    api_key: env.identifiers.app,
  }))
}

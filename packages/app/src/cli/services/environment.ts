import {selectOrCreateApp} from './dev/select-app'
import {fetchAllStores, fetchAppFromApiKey, fetchOrgAndApps, fetchOrganizations, FetchResponse} from './dev/fetch'
import {selectStore, convertToTestStoreIfNeeded} from './dev/select-store'
import {selectOrganizationPrompt} from '../prompts/dev'
import {App, Identifiers, updateAppIdentifiers, getAppIdentifiers, Extension} from '../models/app/app'
import {Organization, OrganizationApp, OrganizationStore} from '../models/organization'
import {error, output, session, store as conf, ui, environment} from '@shopify/cli-kit'

const InvalidApiKeyError = (apiKey: string) => {
  return new error.Abort(
    `Invalid API key: ${apiKey}`,
    'You can find the apiKey in the app settings in the Partner Dashboard.',
  )
}

export interface DevEnvironmentOptions {
  app: App
  apiKey?: string
  store?: string
  reset: boolean
}

interface DevEnvironmentOutput {
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'> & {apiSecret?: string}
  store: string
  identifiers: Identifiers
}

/**
 * Make sure there is a valid environment to execute `dev`
 * That means we have a valid organization, app and dev store selected.
 *
 * If there are app/store from flags, we check if they are valid. If they are not, throw an error.
 * If there is cached info (user ran `dev` previously), check if it is still valid and return it.
 * If there is no cached info (or is invalid):
 *  - Show prompts to select an org, app and dev store
 *  - The new selection will be saved as global configuration
 *  - The `shopify.app.toml` file will be updated with the new app apiKey
 *
 * @param options {DevEnvironmentInput} Current dev environment options
 * @returns {Promise<DevEnvironmentOutput>} The selected org, app and dev store
 */
export async function ensureDevEnvironment(options: DevEnvironmentOptions): Promise<DevEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()
  const identifiers = await getAppIdentifiers({app: options.app, environmentType: 'local'})
  const cachedInfo = getCachedInfo(options.reset, identifiers.app)

  const explanation =
    `\nLooks like this is the first time you're running dev for this project.\n` +
    'Configure your preferences by answering a few questions.\n'

  if (cachedInfo === undefined && !options.reset) {
    output.info(explanation)
  }

  const orgId = cachedInfo?.orgId || (await selectOrg(token))
  const {organization, apps, stores} = await fetchOrgsAppsAndStores(orgId, token)

  let {app: selectedApp, store: selectedStore} = await dataFromInput(options, organization, stores, token)
  if (selectedApp && selectedStore) {
    // eslint-disable-next-line no-param-reassign
    options = await updateOptionsApp({...options, apiKey: selectedApp.apiKey})

    conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore, orgId})
    return {
      app: {
        ...selectedApp,
        apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
      },
      store: selectedStore,
      identifiers: {
        app: selectedApp.apiKey,
        extensions: {},
      },
    }
  }

  selectedApp = selectedApp || (await selectOrCreateApp(options.app, apps, orgId, token, cachedInfo?.appId))
  conf.setAppInfo(selectedApp.apiKey, {orgId})

  // eslint-disable-next-line no-param-reassign
  options = await updateOptionsApp({...options, apiKey: selectedApp.apiKey})
  selectedStore = selectedStore || (await selectStore(stores, organization, token, cachedInfo?.storeFqdn))
  conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore})

  if (selectedApp.apiKey === cachedInfo?.appId && selectedStore === cachedInfo.storeFqdn) {
    showReusedValues(organization.businessName, options.app, selectedStore)
  }

  return {
    app: {
      ...selectedApp,
      apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
    },
    store: selectedStore,
    identifiers: {
      app: selectedApp.apiKey,
      extensions: {},
    },
  }
}

async function updateOptionsApp(options: DevEnvironmentOptions & {apiKey: string}) {
  const updatedApp = await updateAppIdentifiers({
    app: options.app,
    identifiers: {
      app: options.apiKey,
      extensions: {},
    },
    environmentType: 'local',
  })
  return {
    ...options,
    app: updatedApp,
  }
}

export interface DeployEnvironmentOptions {
  app: App
}

interface DeployEnvironmentOutput {
  app: App
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
}

export async function ensureDeployEnvironment(options: DeployEnvironmentOptions): Promise<DeployEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()
  const envIdentifiers = await getAppIdentifiers({app: options.app, environmentType: 'production'})
  const areIdentifiersMissing = getAreIdentifiersMissing(options.app, envIdentifiers)

  let identifiers: Identifiers
  let partnersApp: OrganizationApp

  if (areIdentifiersMissing) {
    const orgId = await selectOrg(token)
    const {apps} = await fetchOrgsAppsAndStores(orgId, token)

    let appId: string
    if (envIdentifiers.app) {
      appId = envIdentifiers.app
      partnersApp = await fetchAppFromApiKey(appId, token)
    } else {
      partnersApp = await selectOrCreateApp(options.app, apps, orgId, token, undefined)
      appId = partnersApp.apiKey
    }

    identifiers = {
      app: appId,
      extensions: {},
    }
    // eslint-disable-next-line no-param-reassign
    options = {
      ...options,
      app: await updateAppIdentifiers({app: options.app, identifiers, environmentType: 'production'}),
    }
  } else {
    identifiers = envIdentifiers as Identifiers
    partnersApp = await fetchAppFromApiKey(identifiers.app, token)
  }

  return {
    app: options.app,
    partnersApp: {
      id: partnersApp.id,
      title: partnersApp.title,
      appType: partnersApp.appType,
    },
    identifiers,
  }
}

function getAreIdentifiersMissing(app: App, identifiers: Partial<Identifiers>): boolean {
  const appIdMissing = identifiers.app === 'undefined'

  const anyExtensionMissingId = (extensions: Extension[]): boolean => {
    return (
      extensions.find((extension) => {
        return identifiers.extensions ? !identifiers?.extensions[extension.localIdentifier] : true
      }) === undefined
    )
  }
  const anyExtensionIdMissing =
    anyExtensionMissingId(app.extensions.ui) ||
    anyExtensionMissingId(app.extensions.theme) ||
    anyExtensionMissingId(app.extensions.function)

  return appIdMissing || anyExtensionIdMissing
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data = {} as FetchResponse
  const list = new ui.Listr(
    [
      {
        title: 'Fetching organization data',
        task: async () => {
          const responses = await Promise.all([fetchOrgAndApps(orgId, token), fetchAllStores(orgId, token)])
          data = {...responses[0], stores: responses[1]} as FetchResponse
          // We need ALL stores so we can validate the selected one.
          // This is a temporary workaround until we have an endpoint to fetch only 1 store to validate.
        },
      },
    ],
    {rendererSilent: environment.local.isUnitTest()},
  )
  await list.run()
  return data
}

/**
 * Any data sent via input flags takes precedence and needs to be validated.
 * If any of the inputs is invalid, we must throw an error and stop the execution.
 * @param input
 * @returns
 */
async function dataFromInput(
  options: DevEnvironmentOptions,
  org: Organization,
  stores: OrganizationStore[],
  token: string,
): Promise<{app?: OrganizationApp; store?: string}> {
  let selectedApp: OrganizationApp | undefined
  let selectedStore: string | undefined

  if (options.apiKey) {
    selectedApp = await fetchAppFromApiKey(options.apiKey, token)
    if (!selectedApp) throw InvalidApiKeyError(options.apiKey)
  }

  if (options.store) {
    await convertToTestStoreIfNeeded(options.store, stores, org, token)
    selectedStore = options.store
  }

  return {app: selectedApp, store: selectedStore}
}

/**
 * Retrieve cached info from the global configuration based on the current local app
 * @param reset {boolean} Wheter to reset the cache or not
 * @param appId {string} Current local app id, used to retrieve the cached info
 * @returns
 */
function getCachedInfo(reset: boolean, apiKey?: string): conf.CachedAppInfo | undefined {
  if (!apiKey) return undefined
  if (apiKey && reset) conf.clearAppInfo(apiKey)
  return conf.getAppInfo(apiKey)
}

/**
 * Fetch all orgs the user belongs to and show a prompt to select one of them
 * @param token {string} Token to access partners API
 * @returns {Promise<string>} The selected organization ID
 */
async function selectOrg(token: string): Promise<string> {
  const orgs = await fetchOrganizations(token)
  const org = await selectOrganizationPrompt(orgs)
  return org.id
}

/**
 * Message shown to the user in case we are reusing a previous configuration
 * @param org {string} Organization name
 * @param app {string} App name
 * @param store {string} Store domain
 */
function showReusedValues(org: string, app: App, store: string) {
  output.info('\nUsing your previous dev settings:')
  output.info(`Org:        ${org}`)
  output.info(`App:        ${app.name}`)
  output.info(`Dev store:  ${store}\n`)
  output.info(
    output.content`To reset your default dev config, run ${output.token.command(
      `${app.dependencyManager} dev --reset`,
    )}\n`,
  )
}

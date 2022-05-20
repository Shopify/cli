import {selectOrCreateApp} from './select-app'
import {fetchAllStores, fetchAppFromApiKey, fetchOrgAndApps, fetchOrganizations, FetchResponse} from './fetch'
import {selectStore, convertToTestStoreIfNeeded} from './select-store'
import {selectOrganizationPrompt} from '../../prompts/dev'
import {App, Identifiers} from '../../models/app/app'
import {Organization, OrganizationApp, OrganizationStore} from '../../models/organization'
import {updateAppConfigurationFile} from '../../utilities/app/update'
import {error, output, session, store as conf, ui} from '@shopify/cli-kit'

const InvalidApiKeyError = (apiKey: string) => {
  return new error.Abort(
    `Invalid API key: ${apiKey}`,
    'You can find the apiKey in the app settings in the Partner Dashboard.',
  )
}

export interface DevEnvironmentInput {
  app: App
  apiKey?: string
  store?: string
  reset: boolean
}

interface DevEnvironmentOutput {
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
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
 * @param app {App} Current local app information
 * @returns {Promise<DevEnvironmentOutput>} The selected org, app and dev store
 */
export async function ensureDevEnvironment(input: DevEnvironmentInput): Promise<DevEnvironmentOutput> {
  const token = await session.ensureAuthenticatedPartners()
  const cachedInfo = getCachedInfo(input.reset, input.app.configuration.id)
  const orgId = cachedInfo?.orgId || (await selectOrg(token))
  const {organization, apps, stores} = await fetchOrgsAppsAndStores(orgId, token)

  let {app: selectedApp, store: selectedStore} = await dataFromInput(input, organization, stores, token)
  if (selectedApp && selectedStore) {
    updateAppConfigurationFile(input.app, {id: selectedApp.apiKey, name: selectedApp.title})
    conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore, orgId})
    return {
      app: selectedApp,
      store: selectedStore,
      identifiers: {
        app: {
          apiKey: selectedApp.apiKey,
          apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        extensions: {'ext-01': '44caf0ff-117c-4ccb-bcb1-71cef978d07c'},
      },
    }
  }

  selectedApp = selectedApp || (await selectOrCreateApp(input.app, apps, orgId, token, cachedInfo?.appId))
  conf.setAppInfo(selectedApp.apiKey, {orgId})

  updateAppConfigurationFile(input.app, {id: selectedApp.apiKey, name: selectedApp.title})
  selectedStore = selectedStore || (await selectStore(stores, organization, token, cachedInfo?.storeFqdn))
  conf.setAppInfo(selectedApp.apiKey, {storeFqdn: selectedStore})

  if (selectedApp.apiKey === cachedInfo?.appId && selectedStore === cachedInfo.storeFqdn) {
    showReusedValues(organization.businessName, selectedApp.title, selectedStore)
  }

  return {
    app: selectedApp,
    store: selectedStore,
    identifiers: {
      app: {
        apiKey: selectedApp.apiKey,
        apiSecret: selectedApp.apiSecretKeys.length === 0 ? undefined : selectedApp.apiSecretKeys[0].secret,
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      extensions: {'ext-01': '44caf0ff-117c-4ccb-bcb1-71cef978d07c'},
    },
  }
}

export interface DeployEnvironmentOptions {
  app: App
  apiKey?: string
  reset: boolean
}

interface DeployEnvironmentOutput {
  app: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  identifiers: Identifiers
}

export async function ensureDeployEnvironment(options: DeployEnvironmentOptions): Promise<DeployEnvironmentOutput> {
  return {
    app: {
      id: '123',
      title: 'title',
      appType: 'type',
    },
    identifiers: {
      app: {
        apiKey: 'NOTDONE',
        apiSecret: 'NOTDONE',
      },
      extensions: {},
    },
  }
}

async function fetchOrgsAppsAndStores(orgId: string, token: string): Promise<FetchResponse> {
  let data: any = {}
  const list = new ui.Listr([
    {
      title: 'Fetching organization data',
      task: async () => {
        const responses = await Promise.all([fetchOrgAndApps(orgId, token), fetchAllStores(orgId, token)])
        data = {...responses[0], stores: responses[1]}
        // We need ALL stores so we can validate the selected one.
        // This is a temporary workaround until we have an endpoint to fetch only 1 store to validate.
      },
    },
  ])
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
  input: DevEnvironmentInput,
  org: Organization,
  stores: OrganizationStore[],
  token: string,
): Promise<{app?: OrganizationApp; store?: string}> {
  let selectedApp: OrganizationApp | undefined
  let selectedStore: string | undefined

  if (input.apiKey) {
    selectedApp = await fetchAppFromApiKey(input.apiKey, token)
    if (!selectedApp) throw InvalidApiKeyError(input.apiKey)
  }

  if (input.store) {
    await convertToTestStoreIfNeeded(input.store, stores, org, token)
    selectedStore = input.store
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
function showReusedValues(org: string, app: string, store: string) {
  output.info(`\nReusing the org, app, dev store settings from your last run:`)
  output.info(`Organization: ${org}`)
  output.info(`App: ${app}`)
  output.info(`Dev store: ${store}\n`)
  output.info('To change your default settings, use the following flags:')
  output.info(`--api-key to change your app`)
  output.info('--store to change your dev store')
  output.info('--reset to reset all your settings\n')
}

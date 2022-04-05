import {fetchAppsAndStores} from './fetch'
import {error, output, session} from '@shopify/cli-kit'
import {OrganizationStore} from '$cli/models/organization'
import {reloadStoreListPrompt, selectStorePrompt} from '$cli/prompts/dev'

const InvalidStoreError = (apiKey: string) => {
  return new error.Fatal(`Invalid Store domain: ${apiKey}`, 'Check that the provided Store is correct and try again.')
}

const CreateStoreLink = (orgId: string) => {
  const url = `https://partners.shopify.com/${orgId}/stores/new?store_type=dev_store`
  return `Click here to create a new dev store to preview your project:\n${url}\n`
}

/**
 * Select store from list or
 * If an envStore is provided, we check if it is valid and return it. If it's not valid, throw error
 * If a cachedStoreName is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @param cachedStoreName {string} Cached store name
 * @param envStore {string} Store from the environment/flag
 * @returns {Promise<OrganizationStore>} The selected store
 */
export async function selectStore(
  stores: OrganizationStore[],
  orgId: string,
  cachedStoreName?: string,
  envStore?: string,
): Promise<OrganizationStore> {
  if (envStore) {
    const envStoreInfo = validateStore(stores, envStore)
    if (envStoreInfo) return envStoreInfo
    throw InvalidStoreError(envStore)
  }

  const cachedStore = validateStore(stores, cachedStoreName)
  if (cachedStore) return cachedStore

  const store = await selectStorePrompt(stores)
  if (store) return store

  output.info(`\n${CreateStoreLink(orgId)}`)
  const reload = await reloadStoreListPrompt()
  if (!reload) throw new error.AbortSilent()

  const token = await session.ensureAuthenticatedPartners()
  const data = await fetchAppsAndStores(orgId, token)
  return selectStore(data.stores, orgId)
}

/**
 *  Check if the provided storeDomain exists in the list of retrieved stores
 * @param stores {OrganizationStore[]} List of remote available stores
 * @param storeDomain {string} Store domain to check
 * @returns {OrganizationStore} The store if it exists, undefined otherwise
 */
function validateStore(stores: OrganizationStore[], storeDomain?: string) {
  return stores.find((store) => store.shopDomain === storeDomain)
}

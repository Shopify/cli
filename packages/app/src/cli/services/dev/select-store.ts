import {fetchAllStores} from './fetch'
import {error, output, api} from '@shopify/cli-kit'
import {Organization, OrganizationStore} from '$cli/models/organization'
import {convertToDevStorePrompt, reloadStoreListPrompt, selectStorePrompt} from '$cli/prompts/dev'

const ConvertToDevError = (storeName: string, message: string) => {
  return new error.Bug(
    `Error converting store ${storeName} to a Test store: ${message}`,
    'This store might not be compatible with draft apps, please try a different store',
  )
}

const StoreNotFoundError = (storeName: string, org: Organization) => {
  return new error.Bug(
    `Could not find ${storeName} in the Organization ${org.businessName} as a valid development store.`,
    `Visit https://partners.shopify.com/${org.id}/stores to create a new store in your organization`,
  )
}

const CreateStoreLink = (orgId: string) => {
  const url = `https://partners.shopify.com/${orgId}/stores/new?store_type=dev_store`
  return `Click here to create a new dev store to preview your project:\n${url}\n`
}

/**
 * Select store from list or
 * If a cachedStoreName is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @param cachedStoreName {string} Cached store name
 * @returns {Promise<string>} The selected store
 */
export async function selectStore(
  stores: OrganizationStore[],
  org: Organization,
  token: string,
  cachedStoreName?: string,
): Promise<string> {
  if (cachedStoreName) {
    const isValid = await validateOrConverToDevStore(cachedStoreName, stores, org, token)
    if (isValid) return cachedStoreName
  }

  const store = await selectStorePrompt(stores)
  if (store) {
    const isValid = await validateOrConverToDevStore(store.shopDomain, stores, org, token)
    if (!isValid) return selectStore(stores, org, token)
    return store.shopDomain
  }

  output.info(`\n${CreateStoreLink(org.id)}`)
  const reload = await reloadStoreListPrompt()
  if (!reload) throw new error.AbortSilent()

  const data = await fetchAllStores(org.id, token)
  return selectStore(data, org, token)
}

/**
 * Check if the store exists in the current organization and it is a valid store
 * To be valid, it must be non-transferable.
 * @param storeDomain {string} Store domain to check
 * @param stores {OrganizationStore[]} List of available stores
 * @param orgId {string} Current organization ID
 * @param token {string} Token to access partners API
 * @returns {Promise<boolean>} True if the store is valid
 * @throws {Fatal} If the store can't be found in the organization or we fail to make it a dev store
 */
export async function validateOrConverToDevStore(
  storeDomain: string,
  stores: OrganizationStore[],
  org: Organization,
  token: string,
): Promise<boolean> {
  const store = stores.find((store) => store.shopDomain === storeDomain)
  if (!store) throw StoreNotFoundError(storeDomain, org)
  if (store.transferDisabled) return true
  const shouldConvert = await convertToDevStorePrompt(store.shopDomain)
  if (shouldConvert) await convertStoreToTest(store, org.id, token)
  return shouldConvert
}

/**
 * Convert a store to a dev store so development apps can be installed
 * This can't be undone, so we ask the user to confirm
 * @param store {OrganizationStore} Store to convert
 * @param orgId {string} Current organization ID
 * @param token {string} Token to access partners API
 */
export async function convertStoreToTest(store: OrganizationStore, orgId: string, token: string) {
  const query = api.graphql.ConvertDevToTestStoreQuery
  const variables: api.graphql.ConvertDevToTestStoreVariables = {
    input: {
      organizationID: parseInt(orgId, 10),
      shopId: store.shopId,
    },
  }
  const result: api.graphql.ConvertDevToTestStoreSchema = await api.partners.request(query, token, variables)
  if (!result.convertDevToTestStore.convertedToTestStore) {
    const errors = result.convertDevToTestStore.userErrors.map((error) => error.message).join(', ')
    throw ConvertToDevError(store.shopDomain, errors)
  }
  output.success(`Converted ${store.shopDomain} to a Dev store`)
}

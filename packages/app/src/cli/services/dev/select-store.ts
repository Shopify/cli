import {fetchAllStores, fetchStoreByDomain} from './fetch.js'
import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {error, output, api, system, ui, environment} from '@shopify/cli-kit'

const ConvertToDevError = (storeName: string, message: string) => {
  return new error.Bug(
    `Error converting store ${storeName} to a Test store: ${message}`,
    'This store might not be compatible with draft apps, please try a different store',
  )
}

const InvalidStore = (storeName: string) => {
  return new error.Abort(
    `The store you specified (${storeName}) is not a dev store`,
    'Run dev --reset and select an eligible dev store.',
  )
}

const CreateStoreLink = async (orgId: string) => {
  const url = `https://${await environment.fqdn.partners()}/${orgId}/stores/new?store_type=dev_store`
  return (
    `Looks like you don't have a dev store in the Partners org you selected. ` +
    `Keep going — create a dev store on Shopify Partners:\n${url}\n`
  )
}

/**
 * Select store from list or
 * If a cachedStoreName is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores - List of available stores
 * @param orgId - Current organization ID
 * @param cachedStoreName - Cached store name
 * @returns The selected store
 */
export async function selectStore(
  stores: OrganizationStore[],
  org: Organization,
  token: string,
  cachedStoreName?: string,
): Promise<OrganizationStore> {
  if (cachedStoreName) {
    const result = await fetchStoreByDomain(org.id, token, cachedStoreName)
    if (result?.store) {
      await convertToTestStoreIfNeeded(result.store, org, token)
      return result.store
    }
  }

  const store = await selectStorePrompt(stores)
  if (store) {
    await convertToTestStoreIfNeeded(store, org, token)
    return store
  }

  output.info(`\n${await CreateStoreLink(org.id)}`)
  await system.sleep(5)

  const reload = await reloadStoreListPrompt(org)
  if (!reload) {
    throw new error.CancelExecution()
  }

  const data = await waitForCreatedStore(org.id, token)
  return selectStore(data, org, token)
}

/**
 * Retrieves the list of stores from an organization, retrying a few times if the list is empty.
 * That is because after creating the dev store, it can take some seconds for the API to return it.
 * @param orgId - Current organization ID
 * @param token - Token to access partners API
 * @returns List of stores
 */
async function waitForCreatedStore(orgId: string, token: string): Promise<OrganizationStore[]> {
  const retries = 10
  const secondsToWait = 3
  let data = [] as OrganizationStore[]
  const list = ui.newListr(
    [
      {
        title: 'Fetching organization data',
        task: async () => {
          for (let i = 0; i < retries; i++) {
            // eslint-disable-next-line no-await-in-loop
            const stores = await fetchAllStores(orgId, token)
            if (stores.length > 0) {
              data = stores
              return
            }
            // eslint-disable-next-line no-await-in-loop
            await system.sleep(secondsToWait)
          }
        },
      },
    ],
    {rendererSilent: environment.local.isUnitTest()},
  )
  await list.run()

  return data
}

/**
 * Check if the store exists in the current organization and it is a valid store
 * To be valid, it must be non-transferable.
 * @param storeDomain - Store domain to check
 * @param stores - List of available stores
 * @param orgId - Current organization ID
 * @param token - Token to access partners API
 * @returns True if the store is valid
 * @throws If the store can't be found in the organization or we fail to make it a test store
 */
export async function convertToTestStoreIfNeeded(
  store: OrganizationStore,
  org: Organization,
  token: string,
): Promise<void> {
  /**
   * Is not possible to convert stores to dev ones in spin environmets. Should be created directly as development.
   */
  if (environment.service.isSpinEnvironment() && environment.local.firstPartyDev()) return
  if (!store.transferDisabled && !store.convertableToPartnerTest) throw InvalidStore(store.shopDomain)
  if (!store.transferDisabled) await convertStoreToTest(store, org.id, token)
}

/**
 * Convert a store to a test store so development apps can be installed
 * This can't be undone, so we ask the user to confirm
 * @param store - Store to convert
 * @param orgId - Current organization ID
 * @param token - Token to access partners API
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
  output.success(`Converted ${store.shopDomain} to a Test store`)
}

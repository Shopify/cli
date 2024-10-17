import {fetchStore} from './dev/fetch.js'
import {selectStore} from './dev/select-store.js'
import {LoadedAppContextOutput} from './app-context.js'
import {OrganizationStore} from '../models/organization.js'

/**
 * Input options for the `storeContext` function.
 *
 * @param app - The local app, used to get the dev store url from the toml configuration.
 * @param organization - The organization to get the store from.
 * @param developerPlatformClient - The developer platform client to use to fetch the store.
 * @param storeFqdn - The store FQDN, optional, when explicitly provided it has preference over anything else.
 */
interface StoreContextOptions {
  appContextResult: LoadedAppContextOutput
  forceReselectStore: boolean
  storeFqdn?: string
}

/**
 * Returns a Store based on the provided options. If a store can't be retrieved, it throws an error.
 *
 * If a storeFqdn is explicitly provided, it has preference over anything else.
 * If not, check if there is a cached storeFqdn in the app configuration. If forceReselectStore is true, it will be ignored.
 * If still don't have a store, fetch all stores for the organization and let the user select one.
 */
export async function storeContext({
  appContextResult,
  storeFqdn,
  forceReselectStore,
}: StoreContextOptions): Promise<OrganizationStore> {
  const {app, organization, developerPlatformClient} = appContextResult
  let selectedStore: OrganizationStore

  // An explicit storeFqdn has preference over anything else.
  const cachedStoreInToml = forceReselectStore ? undefined : app.configuration.build?.dev_store_url
  const storeFqdnToUse = storeFqdn || cachedStoreInToml
  if (storeFqdnToUse) {
    selectedStore = await fetchStore(organization, storeFqdnToUse, developerPlatformClient)
  } else {
    // If no storeFqdn is provided, fetch all stores for the organization and let the user select one.
    const allStores = await developerPlatformClient.devStoresForOrg(organization.id)
    selectedStore = await selectStore(allStores, organization, developerPlatformClient)
  }

  return selectedStore
}

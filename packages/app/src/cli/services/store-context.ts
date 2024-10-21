import {fetchStore} from './dev/fetch.js'
import {selectStore} from './dev/select-store.js'
import {LoadedAppContextOutput} from './app-context.js'
import {OrganizationStore} from '../models/organization.js'

/**
 * Input options for the `storeContext` function.
 *
 * @param appContextResult - The result of the app context function.
 * @param forceReselectStore - Whether to force reselecting the store.
 * @param storeFqdn - a store FQDN, optional, when explicitly provided it has preference over anything else.
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

  // If forceReselectStore is true, ignore the cached storeFqdn in the app configuration.
  const cachedStoreInToml = forceReselectStore ? undefined : app.configuration.build?.dev_store_url

  // An explicit storeFqdn has preference over anything else.
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

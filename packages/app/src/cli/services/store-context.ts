import {fetchStore} from './dev/fetch.js'
import {selectStore} from './dev/select-store.js'
import {Organization, OrganizationStore} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../models/app/app.js'

/**
 * Input options for the `storeContext` function.
 *
 * @param app - The local app, used to get the dev store url from the toml configuration.
 * @param organization - The organization to get the store from.
 * @param developerPlatformClient - The developer platform client to use to fetch the store.
 * @param storeFqdn - The store FQDN, optional, when explicitly provided it has preference over anything else.
 */
interface StoreContextOptions {
  app: AppLinkedInterface
  organization: Organization
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn?: string
}

/**
 * Returns a Store based on the provided options. If a store can't be retrieved, it throws an error.
 *
 * If a storeFqdn is explicitly provided, it has preference over anything else.
 * If not, check if there is a cached storeFqdn in the app toml configuration.
 * If not, fetch all stores for the organization and let the user select one.
 */
export async function storeContext({
  app,
  organization,
  developerPlatformClient,
  storeFqdn,
}: StoreContextOptions): Promise<OrganizationStore> {
  let selectedStore: OrganizationStore

  // An explicit storeFqdn has preference over anything else.
  const storeFqdnToUse = storeFqdn || app.configuration.build?.dev_store_url
  if (storeFqdnToUse) {
    selectedStore = await fetchStore(organization, storeFqdnToUse, developerPlatformClient)
  } else {
    // If no storeFqdn is provided, fetch all stores for the organization and let the user select one.
    const allStores = await developerPlatformClient.devStoresForOrg(organization.id)
    selectedStore = await selectStore(allStores, organization, developerPlatformClient)
  }

  return selectedStore
}

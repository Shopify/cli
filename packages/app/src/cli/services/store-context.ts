import {fetchOrgFromId, fetchStoreByDomain} from './dev/fetch.js'
import {selectStore} from './dev/select-store.js'
import {OrganizationApp, OrganizationStore} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function storeContext(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  developerPlatformClient: DeveloperPlatformClient,
  storeFqdn?: string,
) {
  let selectedStore: OrganizationStore

  // If a storeFqdn is provided, it has preferences over anything.
  // If not, check if there is a cached storeFqdn in the app toml configuration.
  // If not, force the user to select a store.
  const storeFqdnToUse = storeFqdn || app.configuration.build?.dev_store_url
  if (storeFqdnToUse) {
    const result = await fetchStoreByDomain(remoteApp.organizationId, storeFqdnToUse, developerPlatformClient)
    if (!result) throw new AbortError(`Could not find Organization for id ${remoteApp.organizationId}.`)
    const org = result.organization
    if (!result.store) {
      throw new AbortError(`Could not find ${storeFqdn} in the Organization ${org.businessName} as a valid store.`)
    }
    selectedStore = result.store
  } else {
    const allStores = await developerPlatformClient.devStoresForOrg(remoteApp.organizationId)
    const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)
    if (!organization) throw new AbortError(`Could not find Organization for id ${remoteApp.organizationId}.`)
    selectedStore = await selectStore(allStores, organization, developerPlatformClient)
  }

  return {
    store: selectedStore,
    remoteApp,
    developerPlatformClient,
  }
}

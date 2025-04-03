import {fetchStore} from './dev/fetch.js'
import {convertToTransferDisabledStoreIfNeeded, selectStore} from './dev/select-store.js'
import {LoadedAppContextOutput} from './app-context.js'
import {OrganizationStore, OrganizationUser} from '../models/organization.js'
import metadata from '../metadata.js'
import {configurationFileNames} from '../constants.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {addToGitIgnore} from '@shopify/cli-kit/node/git'
import { Paginateable } from '../utilities/developer-platform-client.js'

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
  let orgUser: OrganizationUser

  const devStoreUrlFromAppConfig = app.configuration.build?.dev_store_url
  const devStoreUrlFromHiddenConfig = app.hiddenConfig.dev_store_url

  const cachedStoreURL = devStoreUrlFromAppConfig ?? devStoreUrlFromHiddenConfig

  // If forceReselectStore is true, ignore the cached storeFqdn in the app configuration.
  const cachedStoreInToml = forceReselectStore ? undefined : cachedStoreURL

  // An explicit storeFqdn has preference over anything else.
  const storeFqdnToUse = storeFqdn ?? cachedStoreInToml

  if (storeFqdnToUse) {
    ({ store: selectedStore, user: orgUser } = await fetchStore(organization, storeFqdnToUse, developerPlatformClient))
    // never automatically convert a store provided via the command line
    await convertToTransferDisabledStoreIfNeeded(selectedStore, organization.id, developerPlatformClient, 'never')
  } else {
    // If no storeFqdn is provided, fetch all stores for the organization and let the user select one.
    let allStores: Paginateable<{stores: OrganizationStore[]}>
    [allStores, orgUser] = await developerPlatformClient.devStoresAndUserForOrg(organization.id)
    selectedStore = await selectStore(allStores, organization, developerPlatformClient)
  }

  await logMetadata(selectedStore, forceReselectStore)
  selectedStore.shopDomain = await normalizeStoreFqdn(selectedStore.shopDomain)

  // Save the selected store in the hidden config file
  if (selectedStore.shopDomain !== cachedStoreURL || !devStoreUrlFromHiddenConfig) {
    await app.updateHiddenConfig({dev_store_url: selectedStore.shopDomain})
    await addToGitIgnore(app.directory, configurationFileNames.hiddenFolder)
  }

  // Ensure that the user is able to login to the store and install apps
  if (orgUser.canEnsureStoreAccess) {
    await developerPlatformClient.ensureUserAccessToStore(organization.id, selectedStore)
  }
  await developerPlatformClient.ensureUserAccessToStore(organization.id, selectedStore)

  return selectedStore
}

async function logMetadata(selectedStore: OrganizationStore, resetUsed: boolean) {
  await metadata.addPublicMetadata(() => ({
    cmd_app_reset_used: resetUsed,
    store_fqdn_hash: hashString(selectedStore.shopDomain),
  }))

  await metadata.addSensitiveMetadata(() => ({
    store_fqdn: selectedStore.shopDomain,
  }))
}

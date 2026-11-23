import {fetchStore} from './dev/fetch.js'
import {ensureTransferDisabledStore, selectStore, StoreCreationMode} from './dev/select-store.js'
import {LoadedAppContextOutput} from './app-context.js'
import {OrganizationStore} from '../models/organization.js'
import {Store} from '../utilities/developer-platform-client.js'
import metadata from '../metadata.js'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Input options for the `storeContext` function.
 *
 * @param appContextResult - The result of the app context function.
 * @param forceReselectStore - Whether to force reselecting the store.
 * @param storeFqdn - a store FQDN, optional, when explicitly provided it has preference over anything else.
 * @param storeTypes - Store types to filter by. Defaults to dev stores only.
 * @param storeCreationMode - When store creation is offered during store selection. Defaults to disabled.
 * @param devSession - Whether the command runs a dev session, whose App Dev API checks the store. Only then can a
 * service account skip the organizations API.
 */
interface StoreContextOptions {
  appContextResult: LoadedAppContextOutput
  forceReselectStore: boolean
  storeFqdn?: string
  storeTypes?: Store[]
  storeCreationMode?: StoreCreationMode
  devSession?: boolean
}

/**
 * Returns a Store based on the provided options. If a store can't be retrieved, it throws an error.
 *
 * If a storeFqdn is explicitly provided, it has preference over anything else.
 * If not, check if there is a cached storeFqdn in the app configuration. If forceReselectStore is true, it will be ignored.
 * If still don't have a store, fetch all stores for the organization and let the user select one.
 *
 * With SHOPIFY_SERVICE_ACCOUNT_TOKEN set, dev session commands need a store domain and don't look the store up or
 * provision access to it: the organizations API only serves user accounts, and the App Dev API checks the store.
 */
export async function storeContext({
  appContextResult,
  storeFqdn,
  forceReselectStore,
  storeTypes = ['APP_DEVELOPMENT'],
  storeCreationMode = 'disabled',
  devSession = false,
}: StoreContextOptions): Promise<OrganizationStore> {
  const {app, organization, developerPlatformClient} = appContextResult
  let selectedStore: OrganizationStore

  const devStoreUrlFromAppConfig = app.configuration.build?.dev_store_url
  const devStoreUrlFromHiddenConfig = app.hiddenConfig.dev_store_url

  const cachedStoreURL = devStoreUrlFromAppConfig ?? devStoreUrlFromHiddenConfig

  // If forceReselectStore is true, ignore the cached storeFqdn in the app configuration.
  const cachedStoreInToml = forceReselectStore ? undefined : cachedStoreURL

  // An explicit storeFqdn has preference over anything else.
  const storeFqdnToUse = storeFqdn ?? cachedStoreInToml

  // Check if we're filtering to dev stores only
  const isDevStoresOnly = storeTypes.length === 1 && storeTypes[0] === 'APP_DEVELOPMENT'

  const skipsOrganizationApi = devSession && isDevStoresOnly && isServiceAccountTokenSet()

  if (skipsOrganizationApi) {
    selectedStore = serviceAccountStore(storeFqdnToUse)
  } else if (storeFqdnToUse) {
    selectedStore = await fetchStore(organization, storeFqdnToUse, developerPlatformClient, storeTypes)
    if (isDevStoresOnly) {
      ensureTransferDisabledStore(selectedStore)
    }
  } else {
    // If no storeFqdn is provided, fetch all stores for the organization and let the user select one.
    const allStores = await developerPlatformClient.devStoresForOrg(organization.id)
    selectedStore = await selectStore(allStores, organization, developerPlatformClient, storeCreationMode)
  }

  selectedStore.shopDomain = normalizeStoreFqdn(selectedStore.shopDomain)
  await logMetadata(selectedStore, forceReselectStore)

  // Save the selected store in the hidden config file. A service account's store isn't checked until the dev session
  // starts, so saving it here could replace a working store with a mistyped one.
  if (!skipsOrganizationApi && (selectedStore.shopDomain !== cachedStoreURL || !devStoreUrlFromHiddenConfig)) {
    await app.updateHiddenConfig({dev_store_url: selectedStore.shopDomain})
  }

  // Ensure that the user is able to login to the store and install apps
  if (!skipsOrganizationApi) {
    await developerPlatformClient.ensureUserAccessToStore(organization.id, selectedStore)
  }

  return selectedStore
}

function serviceAccountStore(storeFqdn: string | undefined): OrganizationStore {
  if (!storeFqdn) {
    throw new AbortError(
      'A service account needs a dev store to run this command.',
      'Pass the dev store with --store, or set build.dev_store_url in the app configuration.',
    )
  }
  const shopDomain = normalizeStoreFqdn(storeFqdn)
  // The store's ID comes from the organizations API, so it's unknown here. Dev skips what needs it: app logs, and
  // customer account extension previews.
  return {
    shopId: '',
    link: '',
    shopDomain,
    shopName: shopDomain,
    transferDisabled: true,
    convertableToPartnerTest: false,
    provisionable: false,
  }
}

async function logMetadata(selectedStore: OrganizationStore, resetUsed: boolean) {
  await metadata.addPublicMetadata(() => ({
    cmd_app_reset_used: resetUsed,
    store_fqdn_hash: hashString(selectedStore.shopDomain),
    store_domain: selectedStore.shopDomain,
  }))

  await metadata.addSensitiveMetadata(() => ({
    store_fqdn: selectedStore.shopDomain,
  }))
}

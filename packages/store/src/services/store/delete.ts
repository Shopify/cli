import {
  AppDevStoreClient,
  gidFromOrganizationIdForShopify,
  OrganizationStore,
} from '../../cli/utilities/app-dev-store-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

export async function deleteStore() {
  // Authenticate if needed
  await ensureAuthenticatedAppManagementAndBusinessPlatform()

  const client = new AppDevStoreClient()
  const organizations = await client.organizations()

  // const organizations = orgsResponse.currentUserAccount?.organizationsWithAccessToDestination?.nodes ?? []

  if (organizations.length === 0) {
    outputInfo('No organizations found.')
    return
  }

  let selectedOrg
  if (organizations.length === 1 && organizations[0]) {
    selectedOrg = organizations[0].id
  } else {
    selectedOrg = await renderSelectPrompt({
      message: 'Which organization?',
      choices: organizations.map((org) => ({
        label: org.businessName,
        value: org.id,
      })),
    })
  }

  const storesPage = selectedOrg ? await client.devStoresForOrg(selectedOrg) : {hasMorePages: false, stores: []}
  let selectedStore: OrganizationStore

  if (storesPage.stores.length === 0) {
    outputInfo(`No dev stores found for organization: ${selectedOrg}`)
  } else {
    if (storesPage.stores.length === 1 && storesPage.stores[0]) {
      selectedStore = storesPage.stores[0]
    } else {
      const selectedStoreId = await renderSelectPrompt({
        message: 'Select a Developer Store:',
        choices: storesPage.stores.map((store) => ({
          label: store.shopDomain,
          value: store.shopId,
        })),
      })
      // There must be a store with the selected ID, otherwise we wouldn't be here
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      selectedStore = storesPage.stores.find((store) => store.shopId === selectedStoreId)!
    }

    const deletedStore = selectedStore
      ? await client.deleteDevStore(gidFromOrganizationIdForShopify(selectedOrg), selectedStore.shopDomain)
      : undefined

    if (!deletedStore) {
      outputInfo(`Unable to delete store: ${selectedStore.shopId}`)
    } else {
      outputInfo(`Store ${selectedStore.shopId} deleted successfully`)
    }
  }
}

import {
  AppDevStoreClient,
  gidFromOrganizationIdForShopify,
  gidFromShopIdForShopify,
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
  let selectedStoreId

  if (storesPage.stores.length === 0) {
    outputInfo(`No dev stores found for organization: ${selectedOrg}`)
  } else {
    if (storesPage.stores.length === 1 && storesPage.stores[0]) {
      selectedStoreId = storesPage.stores[0].shopId
    } else {
      selectedStoreId = await renderSelectPrompt({
        message: 'Select a Developer Store:',
        choices: storesPage.stores.map((store) => ({
          label: store.shopDomain,
          value: store.shopId,
        })),
      })
    }

    const deletedStore = selectedStoreId
      ? await client.deleteDevStore(
          gidFromShopIdForShopify(selectedStoreId),
          gidFromOrganizationIdForShopify(selectedOrg),
        )
      : undefined

    if (!deletedStore) {
      outputInfo(`Unable to delete store: ${selectedStoreId}`)
    } else {
      outputInfo(`Store ${selectedStoreId} deleted successfully`)
    }
  }
}

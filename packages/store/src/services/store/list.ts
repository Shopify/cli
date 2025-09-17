import {AppDevStoreClient} from '../../cli/utilities/app-dev-store-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt, renderTable} from '@shopify/cli-kit/node/ui'

export async function list() {
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

  if (storesPage.stores.length === 0) {
    outputInfo(`No dev stores found for organization: ${selectedOrg}`)
  } else {
    const tableData = storesPage.stores.map((store) => ({
      Name: store.shopName,
      Domain: store.shopDomain,
      ID: store.shopId,
    }))

    renderTable({
      rows: tableData,
      columns: {
        Name: {header: 'Name'},
        Domain: {header: 'Domain'},
        ID: {header: 'ID'},
      },
    })
  }
}

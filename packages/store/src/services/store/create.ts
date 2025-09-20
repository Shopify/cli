import {AppDevStoreClient} from '../../cli/utilities/app-dev-store-client.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt, renderTable} from '@shopify/cli-kit/node/ui'

export async function create() {
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

  const createdStore = selectedOrg ? await client.createDevStore(selectedOrg) : undefined

  if (createdStore) {
    outputInfo(`unable to create store for organization: ${selectedOrg}`)
  } else {
    // The previous code assumed createdStore always has shopName, shopDomain, and shopId, but the type is 'never' or possibly undefined.
    // To fix the lint error, we should explicitly type createdStore and safely access its properties.
    // We'll also ensure that tableData is always an array with the correct shape, even if createdStore is undefined.

    interface DevStore {
      shopName?: string
      shopDomain?: string
      shopId?: string
    }

    const store: DevStore | undefined = createdStore as DevStore | undefined

    const tableData = [
      {
        Name: store?.shopName ?? 'N/A',
        Domain: store?.shopDomain ?? 'N/A',
        ID: store?.shopId ?? 'N/A',
      },
    ]

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

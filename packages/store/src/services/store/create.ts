import {AppDevStoreClient} from '../../cli/utilities/app-dev-store-client.js'
import {OrganizationShopStatusQueryQuery} from '../../cli/api/graphql/business-platform-organizations/generated/poll_dev_store_status.js'
import {outputCompleted, outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {sleep} from '@shopify/cli-kit/node/system'

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

  const developerPreviews = await client.getDeveloperPreviews(selectedOrg)
  let selectedDeveloperPreview
  if (developerPreviews.publishedDeveloperPreviews.length === 1 && developerPreviews.publishedDeveloperPreviews[0]) {
    selectedDeveloperPreview = developerPreviews.publishedDeveloperPreviews[0].handle
  } else {
    selectedDeveloperPreview = await renderSelectPrompt({
      message: 'Which Developer Preview?',
      choices: developerPreviews.publishedDeveloperPreviews.map((preview) => ({
        label: preview.name,
        value: preview.handle,
      })),
    })
  }

  const createdStore = selectedOrg ? await client.createDevStore(selectedOrg, selectedDeveloperPreview) : undefined

  // eslint-disable-next-line no-negated-condition
  if (!createdStore) {
    outputInfo(`unable to create store for organization: ${selectedOrg}`)
  } else {
    const domainForPolling = createdStore.shopDomain

    let result = await client.getStoreStatus(selectedOrg, domainForPolling)

    while (!isDevStoreReady(result)) {
      outputInfo(`Waiting for dev store to be ready... Current status: ${result.organization?.storeCreation?.status}`)
      // eslint-disable-next-line no-await-in-loop
      await sleep(2)

      // eslint-disable-next-line no-await-in-loop
      result = await client.getStoreStatus(selectedOrg, domainForPolling)
    }

    outputCompleted(`Dev store created! ${createdStore.link}`)
  }

  function isDevStoreReady(result: OrganizationShopStatusQueryQuery) {
    return result.organization?.storeCreation?.status === 'COMPLETE'
  }
}

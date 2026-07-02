import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {ClientName, DeveloperPlatformClient, Paginateable} from '../../utilities/developer-platform-client.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {renderInfo, renderTasks} from '@shopify/cli-kit/node/ui'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'
import {AbortError, CancelExecution} from '@shopify/cli-kit/node/error'

/**
 * Select store from list or
 * If a cachedStoreName is provided, we check if it is valid and return it. If it's not valid, ignore it.
 * If there are no stores, show a link to create a store and prompt the user to refresh the store list
 * If no store is finally selected, exit process
 * @param stores - List of available stores
 * @param org - Current organization
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected store
 */
export async function selectStore(
  storesSearch: Paginateable<{stores: OrganizationStore[]}>,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore> {
  const showDomainOnPrompt = developerPlatformClient.clientName === ClientName.AppManagement
  let onSearchForStoresByName
  if (developerPlatformClient.supportsStoreSearch) {
    onSearchForStoresByName = async (term: string) => developerPlatformClient.devStoresForOrg(org.id, term)
  }
  // If no stores, guide the developer through creating one.
  // Then, with a store selected, make sure it's transfer-disabled.
  let store = await selectStorePrompt({
    onSearchForStoresByName,
    ...storesSearch,
    showDomainOnPrompt,
  })
  if (!store) {
    renderInfo({
      body: await developerPlatformClient.getCreateDevStoreLink(org),
    })
    await sleep(5)

    const reload = await reloadStoreListPrompt(org)
    if (!reload) {
      throw new CancelExecution()
    }

    const stores = await waitForCreatedStore(org.id, developerPlatformClient)
    store = await selectStore({stores, hasMorePages: false}, org, developerPlatformClient)
  }

  ensureTransferDisabledStore(store)

  return store
}

/**
 * Retrieves the list of stores from an organization, retrying a few times if the list is empty.
 * That is because after creating the dev store, it can take some seconds for the API to return it.
 * @param orgId - Current organization ID
 * @param developerPlatformClient - The client to access the platform API
 * @returns List of stores
 */
async function waitForCreatedStore(
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore[]> {
  const retries = 10
  const secondsToWait = 3
  let data = [] as OrganizationStore[]
  const tasks = [
    {
      title: 'Fetching organization data',
      task: async () => {
        for (let i = 0; i < retries; i++) {
          // eslint-disable-next-line no-await-in-loop
          const {stores} = await developerPlatformClient.devStoresForOrg(orgId)
          if (stores.length > 0) {
            data = stores
            return
          }
          // eslint-disable-next-line no-await-in-loop
          await sleep(secondsToWait)
        }
      },
    },
  ]
  await renderTasks(tasks)

  return data
}

/**
 * Check if the store exists in the current organization and it is a valid store
 * To be valid, it must be transfer-disabled.
 *
 * @param store - Store to check
 * @throws If the store is not eligible for `app dev`
 */
export function ensureTransferDisabledStore(store: OrganizationStore): void {
  if (store.transferDisabled || firstPartyDev()) return

  if (!store.transferDisabled && !store.convertableToPartnerTest) {
    throw new AbortError(
      `The store you specified (${store.shopDomain}) is not a dev store`,
      'Run dev --reset and select an eligible dev store.',
    )
  }

  throw new AbortError(
    `The store you specified (${store.shopDomain}) is not transfer-disabled`,
    'Run dev --reset and select a transfer-disabled dev store.',
  )
}

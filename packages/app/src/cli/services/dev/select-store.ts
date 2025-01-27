import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'

import {DeveloperPlatformClient, Paginateable} from '../../utilities/developer-platform-client.js'
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
  const showDomainOnPrompt = true
  // If no stores, guide the developer through creating one
  // Then, with a store selected, make sure its transfer-disabled, prompting to convert if needed
  let store = await selectStorePrompt({
    onSearchForStoresByName: async (term: string) => developerPlatformClient.devStoresForOrg(org.id, term),
    ...storesSearch,
    showDomainOnPrompt,
  })
  if (!store) {
    renderInfo({
      body: await developerPlatformClient.getCreateDevStoreLink(org.id),
    })
    await sleep(5)

    const reload = await reloadStoreListPrompt(org)
    if (!reload) {
      throw new CancelExecution()
    }

    const stores = await waitForCreatedStore(org.id, developerPlatformClient)
    store = await selectStore({stores, hasMorePages: false}, org, developerPlatformClient)
  }

  let storeIsValid = await convertToTransferDisabledStoreIfNeeded(store)
  while (!storeIsValid) {
    // eslint-disable-next-line no-await-in-loop
    store = await selectStorePrompt({stores: [store], hasMorePages: false, showDomainOnPrompt})
    if (!store) {
      throw new CancelExecution()
    }
    // eslint-disable-next-line no-await-in-loop
    storeIsValid = await convertToTransferDisabledStoreIfNeeded(store)
  }

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
 * To be valid, it must be non-transferable. This can't be undone, so we ask the user to confirm.
 *
 * @param storeDomain - Store domain to check
 * @param stores - List of available stores
 * @param orgId - Current organization ID
 * @param developerPlatformClient - The client to access the platform API
 * @param conversionMode - Whether to prompt the user to convert the store to a transfer-disabled store, or fail if it's not
 * @returns False, if the store is invalid and the user chose not to convert it. Otherwise true.
 * @throws If the store can't be found in the organization or we fail to make it a transfer-disabled store
 */
export async function convertToTransferDisabledStoreIfNeeded(store: OrganizationStore): Promise<boolean> {
  /**
   * It's not possible to convert stores to dev ones in spin environments. Should be created directly as development.
   * Against production (!isSpinEnvironment()), this allows you to reference other shops in a TOML file even if some of
   * the dev experience isn't completely supported.
   */
  if (store.transferDisabled || firstPartyDev()) return true

  if (!store.transferDisabled && !store.convertableToPartnerTest) {
    throw new AbortError(
      `The store you specified (${store.shopDomain}) is not a dev store`,
      'Run dev --reset and select an eligible dev store.',
    )
  }

  throw new AbortError(
    'The store you specified is not transfer-disabled',
    "Try running 'dev --reset' and selecting a different store, or choosing to convert this one.",
  )
}

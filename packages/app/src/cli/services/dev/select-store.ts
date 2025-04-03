import {Organization, OrganizationStore} from '../../models/organization.js'
import {
  confirmConversionToTransferDisabledStorePrompt,
  reloadStoreListPrompt,
  selectStorePrompt,
} from '../../prompts/dev.js'
import {
  ConvertDevToTransferDisabledSchema,
  ConvertDevToTransferDisabledStoreVariables,
} from '../../api/graphql/convert_dev_to_transfer_disabled_store.js'
import {ClientName, DeveloperPlatformClient, Paginateable} from '../../utilities/developer-platform-client.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {renderInfo, renderTasks} from '@shopify/cli-kit/node/ui'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError, CancelExecution} from '@shopify/cli-kit/node/error'
import {outputSuccess} from '@shopify/cli-kit/node/output'

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
    onSearchForStoresByName = async (term: string) => developerPlatformClient.devStoresAndUserForOrg(org.id, term)
  }
  // If no stores, guide the developer through creating one
  // Then, with a store selected, make sure its transfer-disabled, prompting to convert if needed
  let store = await selectStorePrompt({
    onSearchForStoresByName,
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

  let storeIsValid = await convertToTransferDisabledStoreIfNeeded(
    store,
    org.id,
    developerPlatformClient,
    'prompt-first',
  )
  while (!storeIsValid) {
    // eslint-disable-next-line no-await-in-loop
    store = await selectStorePrompt({stores: [store], hasMorePages: false, showDomainOnPrompt})
    if (!store) {
      throw new CancelExecution()
    }
    // eslint-disable-next-line no-await-in-loop
    storeIsValid = await convertToTransferDisabledStoreIfNeeded(store, org.id, developerPlatformClient, 'prompt-first')
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
          const {stores} = (await developerPlatformClient.devStoresAndUserForOrg(orgId))[0]
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
export async function convertToTransferDisabledStoreIfNeeded(
  store: OrganizationStore,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
  conversionMode: 'prompt-first' | 'never',
): Promise<boolean> {
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

  switch (conversionMode) {
    case 'prompt-first': {
      const confirmed = await confirmConversionToTransferDisabledStorePrompt()
      if (!confirmed) {
        // tell caller the store is invalid and not converted. they may re-prompt etc.
        return false
      }
      await convertStoreToTransferDisabled(store, orgId, developerPlatformClient)
      return true
    }
    case 'never': {
      throw new AbortError(
        'The store you specified is not transfer-disabled',
        "Try running 'dev --reset' and selecting a different store, or choosing to convert this one.",
      )
    }
  }
}

/**
 * Convert a store to a transfer-disabled store so development apps can be installed
 * @param store - Store to convert
 * @param orgId - Current organization ID
 * @param developerPlatformClient - The client to access the platform API
 */
async function convertStoreToTransferDisabled(
  store: OrganizationStore,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: ConvertDevToTransferDisabledStoreVariables = {
    input: {
      organizationID: parseInt(orgId, 10),
      shopId: store.shopId,
    },
  }
  const result: ConvertDevToTransferDisabledSchema = await developerPlatformClient.convertToTransferDisabledStore(
    variables,
  )
  if (!result.convertDevToTestStore.convertedToTestStore) {
    const errors = result.convertDevToTestStore.userErrors.map((error) => error.message).join(', ')
    throw new BugError(
      `Error converting store ${store.shopDomain} to a transfer-disabled store: ${errors}`,
      'This store might not be compatible with draft apps, please try a different store',
    )
  }
  outputSuccess(`Converted ${store.shopDomain} to a transfer-disabled store`)
}

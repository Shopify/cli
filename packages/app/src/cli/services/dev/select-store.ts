import {devStoreCapReached} from './cap.js'
import {fetchStore, StoreNotFoundError} from './fetch.js'
import {Organization, OrganizationStore} from '../../models/organization.js'
import {devStoreNamePrompt, devStorePlanPrompt, reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {ClientName, DeveloperPlatformClient, Paginateable} from '../../utilities/developer-platform-client.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {isTTY, renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortError, CancelExecution} from '@shopify/cli-kit/node/error'
import {createDevStore} from '@shopify/organizations'

/** Store creation from store selection is an explicit command opt-in. */
export type StoreCreationMode = 'disabled' | 'when-empty'

/** Selects an eligible development store, or creates one when creation is enabled and the organization has none. */
export async function selectStore(
  storesSearch: Paginateable<{stores: OrganizationStore[]}>,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
  storeCreationMode: StoreCreationMode = 'disabled',
): Promise<OrganizationStore> {
  const showDomainOnPrompt = developerPlatformClient.clientName === ClientName.AppManagement
  const onSearchForStoresByName = async (term: string) => developerPlatformClient.devStoresForOrg(org.id, term)
  const storeCreationEnabled =
    storeCreationMode === 'when-empty' && developerPlatformClient.clientName === ClientName.AppManagement

  let onCreateStoreWhenEmpty: (() => Promise<OrganizationStore>) | undefined
  if (storeCreationEnabled && storesSearch.stores.length === 0) {
    // Inline store creation needs an interactive terminal.
    if (isTTY() === false) {
      throw new AbortError(
        'No development store was specified.',
        'Create a development store in Dev Dashboard, then run `app dev` again.',
      )
    }
    if (await devStoreCapReached(org.id, developerPlatformClient)) {
      throw new AbortError(devStoreCapReachedMessage, devStoreCapReachedTryMessage)
    }
    onCreateStoreWhenEmpty = async () => {
      if (await devStoreCapReached(org.id, developerPlatformClient)) {
        throw new AbortError(devStoreCapReachedMessage, devStoreCapReachedTryMessage)
      }

      const name = await devStoreNamePrompt()
      const plan = await devStorePlanPrompt()
      const domain = await createDevStore({name, plan, organization: org, json: false, summary: false})
      const createdStore = await waitForCreatedStoreByDomain(org, domain, developerPlatformClient)
      renderSuccess({headline: `Development store "${createdStore.shopName}" created successfully.`})
      return createdStore
    }
  }

  // If no stores, guide the developer through creating one.
  // Then, with a store selected, make sure it's transfer-disabled.
  let store = await selectStorePrompt({
    onSearchForStoresByName,
    ...storesSearch,
    showDomainOnPrompt,
    ...(onCreateStoreWhenEmpty ? {onCreateStoreWhenEmpty} : {}),
  })
  if (!store) {
    if (onCreateStoreWhenEmpty) {
      throw new CancelExecution()
    }

    renderInfo({
      body: await developerPlatformClient.getCreateDevStoreLink(org),
    })
    await sleep(5)

    const reload = await reloadStoreListPrompt(org)
    if (!reload) {
      throw new CancelExecution()
    }

    const stores = await waitForCreatedStore(org.id, developerPlatformClient)
    store = await selectStore({stores, hasMorePages: false}, org, developerPlatformClient, storeCreationMode)
  }

  ensureTransferDisabledStore(store)

  return store
}

async function waitForCreatedStoreByDomain(
  org: Organization,
  shopDomain: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore> {
  const retries = 10
  const secondsToWait = 3
  let store: OrganizationStore | undefined
  const tasks = [
    {
      title: 'Fetching organization data',
      task: async () => {
        for (let i = 0; i < retries; i++) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const fetchedStore = await fetchStore(org, shopDomain, developerPlatformClient)
            if (fetchedStore) {
              store = fetchedStore
              return
            }
          } catch (error) {
            if (!(error instanceof StoreNotFoundError)) throw error
          }

          // eslint-disable-next-line no-await-in-loop
          await sleep(secondsToWait)
        }
      },
    },
  ]
  await renderTasks(tasks)

  if (!store) {
    throw new AbortError(
      `The newly created development store (${shopDomain}) is not available yet.`,
      'Run `app dev --store <store-domain>` to select it when it is ready.',
    )
  }

  return store
}

/** Store list updates can lag after dashboard creation. */
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

const devStoreCapReachedMessage = 'Your organization has reached its development store limit.'
const devStoreCapReachedTryMessage = 'Manage your development store limit in Dev Dashboard, then run `app dev` again.'

/**
 * Check if the store exists in the current organization and it is a valid store
 * To be valid, it must be transfer-disabled.
 *
 * @param store - Store to check
 * @throws If the store is not eligible for `app dev`
 */
export function ensureTransferDisabledStore(store: OrganizationStore): void {
  if (store.transferDisabled) return

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

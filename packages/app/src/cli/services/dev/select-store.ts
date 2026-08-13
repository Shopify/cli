import {Organization, OrganizationStore} from '../../models/organization.js'
import {devStoreNamePrompt, devStorePlanPrompt, reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {ClientName, DeveloperPlatformClient, Paginateable} from '../../utilities/developer-platform-client.js'
import {devStoreCapReached} from './cap.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {isTTY, renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortError, CancelExecution} from '@shopify/cli-kit/node/error'
import {createDevStore} from '@shopify/organizations'
import {fetchStore} from './fetch.js'

export interface SelectStoreResult {
  store: OrganizationStore
  created: boolean
}

/**
 * Select a store from the list or create one when the client supports inline creation.
 * If there are no stores, app-management users can create one inline; Partners users use the dashboard link.
 * If no store is finally selected, exit the process.
 * @param stores - List of available stores
 * @param org - Current organization
 * @param developerPlatformClient - The client to access the platform API
 * @returns The selected store and whether the CLI created it
 */
export async function selectStore(
  storesSearch: Paginateable<{stores: OrganizationStore[]}>,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<SelectStoreResult> {
  if (isTTY() === false) {
    throw new AbortError(
      'No development store was specified.',
      'Run `app dev --store <store-domain>` to select a development store.',
    )
  }

  const showDomainOnPrompt = developerPlatformClient.clientName === ClientName.AppManagement
  const onSearchForStoresByName = async (term: string) => developerPlatformClient.devStoresForOrg(org.id, term)
  const canCreateStore = developerPlatformClient.clientName === ClientName.AppManagement
  const creationCapReached = canCreateStore && (await devStoreCapReached(org.id, developerPlatformClient))
  let created = false

  if (creationCapReached && storesSearch.stores.length === 0) {
    throw devStoreCapReachedError()
  }

  const onCreateStore =
    canCreateStore && !creationCapReached
      ? async () => {
        const name = await devStoreNamePrompt()
        const plan = await devStorePlanPrompt()
        const domain = await createDevStore({name, plan, organization: org, json: false, summary: false})
        const createdStore = await waitForCreatedStoreByDomain(org, domain, developerPlatformClient)
        created = true
        renderSuccess({headline: `Development store "${createdStore.shopName}" created successfully.`})
        return createdStore
      }
      : undefined

  // If no stores, guide the developer through creating one.
  // Then, with a store selected, make sure it's transfer-disabled.
  let store = await selectStorePrompt({
    onSearchForStoresByName,
    ...storesSearch,
    showDomainOnPrompt,
    ...(onCreateStore ? {onCreateStore} : {}),
  })
  if (!store) {
    if (creationCapReached) {
      throw devStoreCapReachedError()
    }
    if (canCreateStore) {
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
    const selection = await selectStore({stores, hasMorePages: false}, org, developerPlatformClient)
    store = selection.store
    created = selection.created
  }

  ensureTransferDisabledStore(store)

  return {store, created}
}

/**
 * Retrieves a newly created store by domain, retrying because the API can lag after creation.
 * @param org - Current organization
 * @param shopDomain - Domain returned by the creation mutation
 * @param developerPlatformClient - The client to access the platform API
 * @returns The created store
 */
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
            if (!(error instanceof AbortError)) throw error
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

/**
 * Retrieves the list of stores from an organization, retrying a few times if the list is empty.
 * That is because after creating the dev store through the Partners dashboard, it can take
 * some seconds for the API to return it.
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

function devStoreCapReachedError(): AbortError {
  return new AbortError(
    'Your organization has reached its development store limit.',
    'Run `app dev --store <store-domain>` to select an existing development store.',
  )
}

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

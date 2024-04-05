import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {
  ConvertDevToTestStoreSchema,
  ConvertDevToTestStoreVariables,
} from '../../api/graphql/convert_dev_to_test_store.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError, CancelExecution} from '@shopify/cli-kit/node/error'
import {outputInfo, outputSuccess} from '@shopify/cli-kit/node/output'

const CreateStoreLink = async (orgId: string) => {
  const url = `https://${await partnersFqdn()}/${orgId}/stores/new?store_type=dev_store`
  return (
    `Looks like you don't have a dev store in the Partners org you selected. ` +
    `Keep going — create a dev store on Shopify Partners:\n${url}\n`
  )
}

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
  stores: OrganizationStore[],
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<OrganizationStore> {
  const store = await selectStorePrompt(stores)
  if (store) {
    await convertToTestStoreIfNeeded(store, org.id, developerPlatformClient)
    return store
  }

  outputInfo(`\n${await CreateStoreLink(org.id)}`)
  await sleep(5)

  const reload = await reloadStoreListPrompt(org)
  if (!reload) {
    throw new CancelExecution()
  }

  const data = await waitForCreatedStore(org.id, developerPlatformClient)
  return selectStore(data, org, developerPlatformClient)
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
          const stores = await developerPlatformClient.devStoresForOrg(orgId)
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
 * To be valid, it must be non-transferable.
 * @param storeDomain - Store domain to check
 * @param stores - List of available stores
 * @param orgId - Current organization ID
 * @param developerPlatformClient - The client to access the platform API
 * @returns True if the store is valid
 * @throws If the store can't be found in the organization or we fail to make it a test store
 */
export async function convertToTestStoreIfNeeded(
  store: OrganizationStore,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<void> {
  /**
   * It's not possible to convert stores to dev ones in spin environments. Should be created directly as development.
   * Against production (!isSpinEnvironment()), this allows you to reference other shops in a TOML file even if some of
   * the dev experience isn't completely supported.
   */
  if (firstPartyDev()) return
  if (!store.transferDisabled && !store.convertableToPartnerTest) {
    throw new AbortError(
      `The store you specified (${store.shopDomain}) is not a dev store`,
      'Run dev --reset and select an eligible dev store.',
    )
  }
  if (!store.transferDisabled) await convertStoreToTest(store, orgId, developerPlatformClient)
}

/**
 * Convert a store to a test store so development apps can be installed
 * This can't be undone, so we ask the user to confirm
 * @param store - Store to convert
 * @param orgId - Current organization ID
 * @param developerPlatformClient - The client to access the platform API
 */
async function convertStoreToTest(
  store: OrganizationStore,
  orgId: string,
  developerPlatformClient: DeveloperPlatformClient,
) {
  const variables: ConvertDevToTestStoreVariables = {
    input: {
      organizationID: parseInt(orgId, 10),
      shopId: store.shopId,
    },
  }
  const result: ConvertDevToTestStoreSchema = await developerPlatformClient.convertToTestStore(variables)
  if (!result.convertDevToTestStore.convertedToTestStore) {
    const errors = result.convertDevToTestStore.userErrors.map((error) => error.message).join(', ')
    throw new BugError(
      `Error converting store ${store.shopDomain} to a Test store: ${errors}`,
      'This store might not be compatible with draft apps, please try a different store',
    )
  }
  outputSuccess(`Converted ${store.shopDomain} to a Test store`)
}

import {selectStore} from './select-store.js'
import {devStoreCapReached} from './cap.js'
import {fetchStore, StoreNotFoundError} from './fetch.js'
import {Organization, OrganizationSource, OrganizationStore} from '../../models/organization.js'
import {devStoreNamePrompt, devStorePlanPrompt, reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {ClientName} from '../../utilities/developer-platform-client.js'
import {sleep} from '@shopify/cli-kit/node/system'
import {isTTY, renderSuccess, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {AbortError, CancelExecution} from '@shopify/cli-kit/node/error'
import {createDevStore} from '@shopify/organizations'
import {beforeEach, describe, expect, vi, test} from 'vitest'

vi.mock('../../prompts/dev')
vi.mock('./cap')
vi.mock('./fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./fetch.js')>()),
  fetchStore: vi.fn(),
}))
vi.mock('@shopify/organizations')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  source: OrganizationSource.BusinessPlatform,
}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: true,
  convertableToPartnerTest: true,
  provisionable: true,
}

const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: true,
  provisionable: true,
}

const STORE3: OrganizationStore = {
  shopId: '3',
  link: 'link3',
  shopDomain: 'domain3',
  shopName: 'store3',
  transferDisabled: false,
  convertableToPartnerTest: false,
  provisionable: true,
}

const defaultShowDomainOnPrompt = false

describe('selectStore', async () => {
  beforeEach(() => {
    vi.mocked(isTTY).mockReturnValue(true)
  })

  test('fails before the prompt in a non-interactive environment when the enabled app-management organization has no stores', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toMatchObject({
      message: 'No development store was specified.',
      tryMessage:
        'Create a development store with `shopify store create dev --organization-id 1 --name <store-name> --plan <plan>`, then run `shopify app dev --store <store-domain>`.',
    })
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreCapReached).toHaveBeenCalledWith(ORG1.id, developerPlatformClient)
    expect(devStoreNamePrompt).not.toHaveBeenCalled()
    expect(devStorePlanPrompt).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('gives cap guidance before the prompt in a non-interactive environment', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(devStoreCapReached).mockResolvedValue(true)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toMatchObject({
      message: 'Your organization has reached its development store limit.',
      tryMessage:
        'Make a development store slot available in Dev Dashboard. Then create a development store with `shopify store create dev --organization-id 1 --name <store-name> --plan <plan>`, then run `shopify app dev --store <store-domain>`.',
    })
    expect(devStoreCapReached).toHaveBeenCalledWith(ORG1.id, developerPlatformClient)
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreNamePrompt).not.toHaveBeenCalled()
    expect(devStorePlanPrompt).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('auto-selects the only app-management store in a non-interactive environment when store creation is enabled', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
        'when-empty',
      ),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStoreWhenEmpty')
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('auto-selects the only Partners store in a non-interactive environment when store creation is enabled', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.Partners}),
        'when-empty',
      ),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStoreWhenEmpty')
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('keeps prompting in a non-interactive environment when store creation is disabled', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
      ),
    ).resolves.toEqual(STORE1)
  })

  test('prompts user to select', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore(
      {stores: [STORE1, STORE2], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners}),
    )

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: defaultShowDomainOnPrompt,
      }),
    )
  })

  test('selectStorePrompt is called with showDomainOnPrompt = true if clientName is app-management', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    // When
    const got = await selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient)

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: true,
      }),
    )
    expect(devStoreCapReached).not.toHaveBeenCalled()
  })

  test('fails with store guidance when the enabled app-management organization is capped and has no stores', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toMatchObject({
      message: 'Your organization has reached its development store limit.',
      tryMessage:
        'Make a development store slot available in Dev Dashboard. Then create a development store with `shopify store create dev --organization-id 1 --name <store-name> --plan <plan>`, then run `shopify app dev --store <store-domain>`.',
    })
    expect(developerPlatformClient.getCreateDevStoreLink).not.toHaveBeenCalled()
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreNamePrompt).not.toHaveBeenCalled()
    expect(devStorePlanPrompt).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('offers creation when the enabled app-management organization has no stores and is not capped', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).toHaveBeenCalledWith(ORG1.id, developerPlatformClient)
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).toHaveProperty('onCreateStoreWhenEmpty')
  })

  test('does not query the cap or offer creation when the enabled app-management organization has stores', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStoreWhenEmpty')
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('does not offer creation when store creation is disabled', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient)).resolves.toEqual(
      STORE1,
    )
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStoreWhenEmpty')
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('offers creation with existing stores when the selection-option app-management organization is not capped', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'selection-option'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).toHaveBeenCalledWith(ORG1.id, developerPlatformClient)
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).toHaveProperty('onCreateStore')
  })

  test('hides creation but keeps paginated store selection when the selection-option organization is capped', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore({stores: [STORE1], hasMorePages: true}, ORG1, developerPlatformClient, 'selection-option'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).toHaveBeenCalledWith(ORG1.id, developerPlatformClient)
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('keeps the dashboard fallback when the capped selection-option app-management store prompt is cancelled', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)

    await expect(
      selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'selection-option'),
    ).rejects.toBeInstanceOf(CancelExecution)
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    expect(sleep).toHaveBeenCalledWith(5)
    expect(reloadStoreListPrompt).toHaveBeenCalledWith(ORG1)
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('does not query the cap or offer creation for Partners with the selection-option mode', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.Partners})
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'selection-option'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('fails before the prompt in a non-interactive environment when the selection-option app-management organization has no stores', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(
      selectStore(
        {stores: [], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
        'selection-option',
      ),
    ).rejects.toMatchObject({
      message: 'No development store was specified.',
      tryMessage:
        'Create a development store with `shopify store create dev --organization-id 1 --name <store-name> --plan <plan>`, then run `shopify app dev --store <store-domain>`.',
    })
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreCapReached).toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('fails before the prompt in a non-interactive environment when selection-option requires choosing between stores', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(
      selectStore(
        {stores: [STORE1, STORE2], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
        'selection-option',
      ),
    ).rejects.toMatchObject({
      message: 'No development store was specified.',
      tryMessage: 'Run `shopify app dev --store <store-domain>` to select a development store.',
    })
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('fails before the prompt in a non-interactive environment when selection-option has more stores to load', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: true},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
        'selection-option',
      ),
    ).rejects.toMatchObject({
      message: 'No development store was specified.',
      tryMessage: 'Run `shopify app dev --store <store-domain>` to select a development store.',
    })
    expect(selectStorePrompt).not.toHaveBeenCalled()
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('auto-selects the only app-management store in a non-interactive environment with the selection-option mode', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
        'selection-option',
      ),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('creates and refetches an app-management store selected from a non-empty list', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(devStoreNamePrompt).mockResolvedValue('created-store')
    vi.mocked(devStorePlanPrompt).mockResolvedValue('grow')
    vi.mocked(createDevStore).mockResolvedValue('created-store.myshopify.com')
    vi.mocked(fetchStore).mockResolvedValueOnce(STORE1)
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStore}) => onCreateStore!())

    await expect(
      selectStore({stores: [STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'selection-option'),
    ).resolves.toEqual(STORE1)
    expect(devStoreCapReached).toHaveBeenCalledTimes(2)
    expect(createDevStore).toHaveBeenCalledWith({
      name: 'created-store',
      plan: 'grow',
      organization: ORG1,
      json: false,
      summary: false,
    })
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Development store "store1" created successfully.'})
  })

  test('keeps the dashboard fallback when the app-management store prompt is cancelled', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)

    await expect(
      selectStore({stores: [STORE1, STORE2], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toBeInstanceOf(CancelExecution)
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    expect(sleep).toHaveBeenCalledWith(5)
    expect(reloadStoreListPrompt).toHaveBeenCalledWith(ORG1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
  })

  test('creates and refetches an app-management store when the organization has none', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(devStoreNamePrompt).mockResolvedValue('created-store')
    vi.mocked(devStorePlanPrompt).mockResolvedValue('grow')
    vi.mocked(createDevStore).mockResolvedValue('created-store.myshopify.com')
    vi.mocked(fetchStore)
      .mockRejectedValueOnce(new StoreNotFoundError('Store is still being provisioned'))
      .mockResolvedValueOnce(STORE1)
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStoreWhenEmpty}) => onCreateStoreWhenEmpty!())

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).resolves.toEqual(STORE1)
    expect(createDevStore).toHaveBeenCalledWith({
      name: 'created-store',
      plan: 'grow',
      organization: ORG1,
      json: false,
      summary: false,
    })
    expect(fetchStore).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(3)
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Development store "store1" created successfully.'})
  })

  test('reports how to select a created store after provisioning retries are exhausted', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(devStoreNamePrompt).mockResolvedValue('created-store')
    vi.mocked(devStorePlanPrompt).mockResolvedValue('grow')
    vi.mocked(createDevStore).mockResolvedValue('created-store.myshopify.com')
    vi.mocked(fetchStore).mockRejectedValue(new StoreNotFoundError('Store is still being provisioned'))
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStoreWhenEmpty}) => onCreateStoreWhenEmpty!())

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toMatchObject({
      message: 'The newly created development store (created-store.myshopify.com) is not available yet.',
      tryMessage: 'Run `shopify app dev --store created-store.myshopify.com` to select it when it is ready.',
    })
    expect(fetchStore).toHaveBeenCalledTimes(10)
  })

  test('stops provisioning retries when fetching the created store fails for a reason other than a missing store', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(devStoreNamePrompt).mockResolvedValue('created-store')
    vi.mocked(devStorePlanPrompt).mockResolvedValue('grow')
    vi.mocked(createDevStore).mockResolvedValue('created-store.myshopify.com')
    vi.mocked(fetchStore).mockRejectedValueOnce(new AbortError('Fetching failed'))
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStoreWhenEmpty}) => onCreateStoreWhenEmpty!())

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toThrow('Fetching failed')
    expect(fetchStore).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalledWith(3)
  })

  test('checks the store cap again before creating a development store', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStoreWhenEmpty}) => onCreateStoreWhenEmpty!())

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toMatchObject({
      message: 'Your organization has reached its development store limit.',
      tryMessage:
        'Make a development store slot available in Dev Dashboard. Then create a development store with `shopify store create dev --organization-id 1 --name <store-name> --plan <plan>`, then run `shopify app dev --store <store-domain>`.',
    })
    expect(devStoreCapReached).toHaveBeenCalledTimes(2)
    expect(devStoreNamePrompt).not.toHaveBeenCalled()
    expect(devStorePlanPrompt).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
    expect(fetchStore).not.toHaveBeenCalled()
  })

  test('throws if selected store is not transfer-disabled', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)

    // When
    const got = selectStore(
      {stores: [STORE1, STORE2], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners}),
    )

    // Then
    await expect(got).rejects.toThrow('The store you specified (domain2) is not transfer-disabled')
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: defaultShowDomainOnPrompt,
      }),
    )
  })

  test('throws if store is non convertible', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE3)

    // When
    const got = selectStore(
      {stores: [STORE1, STORE2, STORE3], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners}),
    )

    // Then
    await expect(got).rejects.toThrow('The store you specified (domain3) is not a dev store')
  })

  test('prompts user to create & reload if prompt returns undefined, throws if reload is false', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)

    // When
    const got = () =>
      selectStore(
        {stores: [STORE1, STORE2], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.Partners}),
      )

    // Then
    await expect(got).rejects.toThrowError()
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: defaultShowDomainOnPrompt,
      }),
    )
  })

  test('prompts user to create & reload, fetches 10 times and tries again if reload is true', async () => {
    // Given
    vi.mocked(sleep).mockResolvedValue()
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.Partners})
    vi.mocked(developerPlatformClient.devStoresForOrg).mockResolvedValue({stores: [], hasMorePages: false})

    // When
    const got = selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient)

    // Then
    await expect(got).rejects.toThrow()
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    expect(developerPlatformClient.devStoresForOrg).toHaveBeenCalledTimes(10)
  })

  test('prompts user to create with Partners link', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.Partners})

    // When
    const got = selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient)

    // Then
    await expect(got).rejects.toThrow()
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    const res = await Promise.resolve(developerPlatformClient.getCreateDevStoreLink(ORG1))
    expect(res).toContain('https://partners.shopify.com/1234/stores')
  })

  test('keeps the dashboard fallback for app-management when store creation is disabled', async () => {
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    await expect(selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient)).rejects.toBeInstanceOf(
      CancelExecution,
    )
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('keeps the Partners dashboard fallback in a non-interactive environment when store creation is enabled', async () => {
    vi.mocked(isTTY).mockReturnValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.Partners})

    await expect(
      selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient, 'when-empty'),
    ).rejects.toBeInstanceOf(CancelExecution)
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    expect(devStoreCapReached).not.toHaveBeenCalled()
    expect(createDevStore).not.toHaveBeenCalled()
  })

  test('enables backend search', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore(
      {stores: [STORE1, STORE2], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners}),
    )

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: defaultShowDomainOnPrompt,
        onSearchForStoresByName: expect.any(Function),
      }),
    )
  })
})

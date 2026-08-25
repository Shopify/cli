import {selectStore} from './select-store.js'
import {devStoreCapReached} from './cap.js'
import {fetchStore} from './fetch.js'
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
vi.mock('./fetch')
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

  test('fails before prompting in a non-interactive environment', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(
      selectStore(
        {stores: [STORE1], hasMorePages: false},
        ORG1,
        testDeveloperPlatformClient({clientName: ClientName.AppManagement}),
      ),
    ).rejects.toThrow('No development store was specified.')
    expect(selectStorePrompt).not.toHaveBeenCalled()
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
  })

  test('fails with store guidance when the app-management organization is capped and has no stores', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)

    await expect(selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient)).rejects.toThrow(
      'reached its development store limit',
    )
    expect(developerPlatformClient.getCreateDevStoreLink).not.toHaveBeenCalled()
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  test('offers creation when the cap check says the organization is not capped', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient)).resolves.toEqual(
      STORE1,
    )
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).toHaveProperty('onCreateStore')
  })

  test('hides creation when the app-management organization is capped but has stores', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    await expect(selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient)).resolves.toEqual(
      STORE1,
    )
    expect(vi.mocked(selectStorePrompt).mock.calls[0]?.[0]).not.toHaveProperty('onCreateStore')
  })

  test('cancels normally when the capped app-management organization has stores and the prompt is cancelled', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(true)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(undefined)

    await expect(
      selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient),
    ).rejects.toBeInstanceOf(CancelExecution)
    expect(developerPlatformClient.getCreateDevStoreLink).not.toHaveBeenCalled()
  })

  test('creates and refetches an app-management store selected inline', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})
    vi.mocked(devStoreCapReached).mockResolvedValue(false)
    vi.mocked(devStoreNamePrompt).mockResolvedValue('created-store')
    vi.mocked(devStorePlanPrompt).mockResolvedValue('grow')
    vi.mocked(createDevStore).mockResolvedValue('created-store.myshopify.com')
    vi.mocked(fetchStore)
      .mockRejectedValueOnce(new AbortError('Store is still being provisioned'))
      .mockResolvedValueOnce(STORE1)
    vi.mocked(renderTasks).mockImplementation(async (tasks: Task[]) => {
      for (const task of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await task.task({}, task)
      }
      return {}
    })
    vi.mocked(selectStorePrompt).mockImplementation(async ({onCreateStore}) => onCreateStore!())

    await expect(selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient)).resolves.toEqual(
      STORE1,
    )
    expect(createDevStore).toHaveBeenCalledWith({
      name: 'created-store',
      plan: 'grow',
      organization: ORG1,
      json: false,
      summary: false,
    })
    expect(fetchStore).toHaveBeenCalledTimes(2)
    expect(renderSuccess).toHaveBeenCalledWith({headline: 'Development store "store1" created successfully.'})
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

  test('cancels without the dashboard fallback for app-management', async () => {
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.AppManagement})

    await expect(selectStore({stores: [STORE1], hasMorePages: false}, ORG1, developerPlatformClient)).rejects.toThrow()
    expect(developerPlatformClient.getCreateDevStoreLink).not.toHaveBeenCalled()
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

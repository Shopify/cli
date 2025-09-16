import {selectStore} from './select-store.js'
import {Organization, OrganizationSource, OrganizationStore} from '../../models/organization.js'
import {
  reloadStoreListPrompt,
  selectStorePrompt,
  confirmConversionToTransferDisabledStorePrompt,
} from '../../prompts/dev.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {ClientName} from '../../utilities/developer-platform-client.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../../prompts/dev')
vi.mock('./fetch')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/system')

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

  test('prompts user to convert store to non-transferable if selection is invalid', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(confirmConversionToTransferDisabledStorePrompt).mockResolvedValueOnce(true)

    // When
    const got = await selectStore(
      {stores: [STORE1, STORE2], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners}),
    )

    // Then
    expect(got).toEqual(STORE2)
    expect(selectStorePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [STORE1, STORE2],
        showDomainOnPrompt: defaultShowDomainOnPrompt,
      }),
    )
    expect(confirmConversionToTransferDisabledStorePrompt).toHaveBeenCalled()
  })

  test('choosing not to convert to transfer-disabled forces another prompt', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)
    vi.mocked(confirmConversionToTransferDisabledStorePrompt).mockResolvedValueOnce(false)

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
    expect(confirmConversionToTransferDisabledStorePrompt).toHaveBeenCalled()
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
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(true)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(false)
    const developerPlatformClient = testDeveloperPlatformClient({clientName: ClientName.Partners})

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

  test('prompts user to create with Developer Dashboard link', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    const developerPlatformClient = testDeveloperPlatformClient({
      clientName: ClientName.AppManagement,
      getCreateDevStoreLink: (org: Organization) =>
        Promise.resolve(
          `Looks like you don't have any dev stores associated with ${org.businessName}'s Dev Dashboard. Create one now https://dev.shopify.com/dashboard/1234/stores`,
        ),
    })

    // When
    const got = selectStore({stores: [], hasMorePages: false}, ORG1, developerPlatformClient)

    // Then
    await expect(got).rejects.toThrow()
    expect(developerPlatformClient.getCreateDevStoreLink).toHaveBeenCalledWith(ORG1)
    const res = await Promise.resolve(developerPlatformClient.getCreateDevStoreLink(ORG1))
    expect(res).toContain('https://dev.shopify.com/dashboard/1234/stores')
  })

  test('enables backend search if the DeveloperPlatformClient supports it', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore(
      {stores: [STORE1, STORE2], hasMorePages: false},
      ORG1,
      testDeveloperPlatformClient({clientName: ClientName.Partners, supportsStoreSearch: true}),
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

import {selectStore} from './select-store'
import {fetchAppsAndStores} from './fetch'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Organization, OrganizationStore} from '$cli/models/organization'
import {reloadStoreListPrompt, selectStorePrompt} from '$cli/prompts/dev'

const ORG1: Organization = {id: '1', businessName: 'org1'}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

beforeEach(() => {
  vi.mock('$cli/prompts/dev')
  vi.mock('./fetch')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
    }
  })
})

describe('selectStore', async () => {
  it('returns store if envStore is valid', async () => {
    // Given
    const envShopDomain = STORE1.shopDomain

    // When
    const got = await selectStore([STORE1, STORE2], '1', 'cached', envShopDomain)

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('throws if envStore is invalid', async () => {
    // Given
    const envShopDomain = 'invalid'

    // When
    const got = selectStore([STORE1, STORE2], '1', 'cached', envShopDomain)

    // Then
    expect(got).rejects.toThrowError(/Invalid Store/)
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('returns store if cachedStoreName is valid and envStore is null', async () => {
    // Given
    const cachedDomain = STORE1.shopDomain

    // When
    const got = await selectStore([STORE1, STORE2], '1', cachedDomain)

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('prompts user to select if there is no envApiKey nor cachedApiKey', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], '1')

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to select if cachedApiKey is invalid', async () => {
    // Given
    const cachedDomain = 'invalid'
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], '1', cachedDomain)

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to create & reload if prompt returns undefined, throws if reload is false', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)

    // When
    const got = selectStore([STORE1, STORE2], '1')

    // Then
    expect(got).rejects.toThrowError()
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to create & reload, fetches and tries again if reload is true', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(true)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(false)
    vi.mocked(fetchAppsAndStores).mockResolvedValue({organization: ORG1, stores: [], apps: []})

    // When
    const got = selectStore([], '1')

    // Then
    expect(selectStorePrompt).toHaveBeenCalled()
    expect(reloadStoreListPrompt).toHaveBeenCalled()
    expect(got).rejects.toThrowError()
  })
})

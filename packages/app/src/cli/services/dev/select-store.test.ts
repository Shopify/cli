import {selectStore} from './select-store.js'
import {fetchAllStores, fetchStoreByDomain} from './fetch.js'
import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {api, environment} from '@shopify/cli-kit'

const ORG1: Organization = {id: '1', businessName: 'org1', appsNext: true}
const STORE1: OrganizationStore = {
  shopId: '1',
  link: 'link1',
  shopDomain: 'domain1',
  shopName: 'store1',
  transferDisabled: true,
  convertableToPartnerTest: true,
}

const STORE2: OrganizationStore = {
  shopId: '2',
  link: 'link2',
  shopDomain: 'domain2',
  shopName: 'store2',
  transferDisabled: false,
  convertableToPartnerTest: true,
}

const STORE3: OrganizationStore = {
  shopId: '3',
  link: 'link3',
  shopDomain: 'domain3',
  shopName: 'store3',
  transferDisabled: false,
  convertableToPartnerTest: false,
}

beforeEach(() => {
  vi.mock('../../prompts/dev')
  vi.mock('./fetch')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
      http: {
        fetch: vi.fn(),
      },
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
      system: {
        sleep: vi.fn(),
      },
      environment: {
        service: {
          isSpinEnvironment: vi.fn(),
        },
        local: {
          firstPartyDev: vi.fn(),
          isUnitTest: vi.fn(() => true),
        },
        fqdn: {
          partners: vi.fn(),
        },
      },
    }
  })
})

describe('selectStore', async () => {
  it('returns store if cachedStoreName and is valid', async () => {
    // Given
    const fqdn = STORE1.shopDomain
    vi.mocked(fetchStoreByDomain).mockResolvedValueOnce({organization: ORG1, store: STORE1})

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token', fqdn)

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('prompts user to select if there is no cachedApiKey', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts to select a new store if cached store fqdn is invalid', async () => {
    // Given
    const fqdn = 'invalid-store-domain'
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)
    vi.mocked(fetchStoreByDomain).mockResolvedValueOnce({organization: ORG1, store: undefined})

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token', fqdn)

    // Then
    expect(got).toEqual(STORE1)
  })

  it('prompts user to convert store to non-transferable if selection is invalid', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(api.partners.request).mockResolvedValueOnce({convertDevToTestStore: {convertedToTestStore: true}})

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE2)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('not prompts user to convert store to non-transferable if selection is invalid inside spin instance and first party', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(environment.service.isSpinEnvironment).mockReturnValue(true)
    vi.mocked(environment.local.firstPartyDev).mockReturnValue(true)

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE2)
    expect(api.partners.request).not.toHaveBeenCalledWith({
      input: {
        organizationID: parseInt(ORG1.id, 10),
        shopId: STORE2.shopId,
      },
    })
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('throws if store is non convertible', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE3)

    // When
    const got = selectStore([STORE1, STORE2, STORE3], ORG1, 'token')

    // Then
    await expect(got).rejects.toThrow('The store you specified (domain3) is not a dev store')
  })

  it('prompts user to create & reload if prompt returns undefined, throws if reload is false', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValue(false)

    // When
    const got = () => selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    await expect(got).rejects.toThrowError()
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to create & reload, fetches 10 times and tries again if reload is true', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValue(undefined)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(true)
    vi.mocked(reloadStoreListPrompt).mockResolvedValueOnce(false)
    vi.mocked(fetchAllStores).mockResolvedValue([])

    // When
    const got = selectStore([], ORG1, 'token')

    // Then
    await expect(got).rejects.toThrow()
    expect(fetchAllStores).toHaveBeenCalledTimes(10)
  })
})

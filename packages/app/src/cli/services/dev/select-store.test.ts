import {selectStore} from './select-store'
import {fetchOrgAndApps} from './fetch'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {http} from '@shopify/cli-kit'
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
      http: {
        fetch: vi.fn(),
      },
    }
  })
})

describe('selectStore', async () => {
  it('returns store if cachedStoreName and is valid', async () => {
    // Given
    const fqdn = STORE1.shopDomain
    vi.mocked(http.fetch).mockResolvedValue({status: 200} as any)

    // When
    const got = await selectStore([STORE1, STORE2], '1', fqdn)

    // Then
    expect(got).toEqual(STORE1.shopDomain)
    expect(selectStorePrompt).not.toHaveBeenCalled()
  })

  it('prompts user to select if there is no cachedApiKey', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], '1')

    // Then
    expect(got).toEqual(STORE1.shopDomain)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to select if cachedApiKey is invalid', async () => {
    // Given
    const fqdn = 'invalid'
    vi.mocked(http.fetch).mockResolvedValue({status: 404} as any)
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], '1', fqdn)

    // Then
    expect(got).toEqual(STORE1.shopDomain)
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
    vi.mocked(fetchOrgAndApps).mockResolvedValue({organization: ORG1, stores: [], apps: []})

    // When
    const got = selectStore([], '1')

    // Then
    expect(got).rejects.toThrow()
  })
})

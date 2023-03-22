import {selectStore} from './select-store.js'
import {fetchAllDevStores} from './fetch.js'
import {Organization, OrganizationStore} from '../../models/organization.js'
import {reloadStoreListPrompt, selectStorePrompt} from '../../prompts/dev.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isSpinEnvironment} from '@shopify/cli-kit/node/context/spin'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'

vi.mock('../../prompts/dev')
vi.mock('./fetch')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/context/spin')

const ORG1: Organization = {
  id: '1',
  businessName: 'org1',
  betas: {},
}
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
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(isSpinEnvironment).mockReturnValue(false)
})

describe('selectStore', async () => {
  it('prompts user to select', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE1)

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE1)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('prompts user to convert store to non-transferable if selection is invalid', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(partnersRequest).mockResolvedValueOnce({convertDevToTestStore: {convertedToTestStore: true}})

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE2)
    expect(selectStorePrompt).toHaveBeenCalledWith([STORE1, STORE2])
  })

  it('not prompts user to convert store to non-transferable if selection is invalid inside spin instance and first party', async () => {
    // Given
    vi.mocked(selectStorePrompt).mockResolvedValueOnce(STORE2)
    vi.mocked(isSpinEnvironment).mockReturnValue(true)
    vi.mocked(firstPartyDev).mockReturnValue(true)

    // When
    const got = await selectStore([STORE1, STORE2], ORG1, 'token')

    // Then
    expect(got).toEqual(STORE2)
    expect(partnersRequest).not.toHaveBeenCalledWith({
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
    vi.mocked(fetchAllDevStores).mockResolvedValue([])

    // When
    const got = selectStore([], ORG1, 'token')

    // Then
    await expect(got).rejects.toThrow()
    expect(fetchAllDevStores).toHaveBeenCalledTimes(10)
  })
})

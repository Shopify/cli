import {listStores} from './index.js'
import * as bpSource from './bp-source.js'
import * as localSource from './local-source.js'
import {describe, expect, test, vi} from 'vitest'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isTTY} from '@shopify/cli-kit/node/ui'
import {fetchOrganizationsWithAccessInfo, selectOrganizationFromList} from '@shopify/organizations'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/organizations')

const acme = {id: '1234', businessName: 'Acme'}
const beta = {id: '5678', businessName: 'Beta'}
const localEntry = {store: 'shop.myshopify.com', connectedAt: '2026-06-03T00:00:00Z'}

const orgEntry = {
  id: 'gid://shopify/Shop/1',
  store: 'shop.myshopify.com',
  createdAt: '2026-01-15T00:00:00Z',
  organizationId: '1234',
  organizationName: 'Acme',
  name: 'Shop',
  type: 'production',
}

function mockOrganizations(organizations = [acme]) {
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
    organizations,
    currentUserResolved: true,
  })
  vi.mocked(selectOrganizationFromList).mockImplementation(async (availableOrganizations, organizationId) => {
    if (organizationId) {
      const organization = availableOrganizations.find((candidate) => candidate.id === organizationId)
      if (!organization) throw new AbortError(`Organization with ID ${organizationId} not found.`)
      return organization
    }

    return availableOrganizations[0]!
  })
}

describe('listStores', () => {
  test('returns store-auth source immediately when requested', async () => {
    vi.spyOn(localSource, 'listLocalStores').mockReturnValue([localEntry])
    const listBusinessPlatformStores = vi.spyOn(bpSource, 'listBusinessPlatformStores')

    const result = await listStores({source: 'store-auth'})

    expect(result).toEqual({stores: [localEntry], source: 'store-auth'})
    expect(listBusinessPlatformStores).not.toHaveBeenCalled()
  })

  test('returns organization results for the only available organization in auto mode', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: [orgEntry]})

    const result = await listStores()

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: true})
    expect(fetchOrganizationsWithAccessInfo).toHaveBeenCalledWith('bp-token', {noPrompt: true})
    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({
      token: 'bp-token',
      organization: acme,
      noPrompt: true,
    })
    expect(selectOrganizationFromList).toHaveBeenCalledWith([acme], undefined)
    expect(result).toEqual({
      stores: [orgEntry],
      source: 'organization',
      organization: {id: '1234', name: 'Acme'},
    })
  })

  test('uses the requested organization id when provided', async () => {
    mockOrganizations([acme, beta])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: []})

    await listStores({organizationId: '5678'})

    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({
      token: 'bp-token',
      organization: beta,
      noPrompt: true,
    })
    expect(selectOrganizationFromList).toHaveBeenCalledWith([acme, beta], '5678')
  })

  test('uses the shared organization selector when multiple are available and no id is provided', async () => {
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(selectOrganizationFromList).mockResolvedValue(beta)
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: []})

    const result = await listStores()

    expect(selectOrganizationFromList).toHaveBeenCalledWith([acme, beta], undefined)
    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({
      token: 'bp-token',
      organization: beta,
      noPrompt: true,
    })
    expect(result.source === 'organization' ? result.organization : undefined).toEqual({id: '5678', name: 'Beta'})
  })

  test('requires an organization id non-interactively when multiple organizations are available', async () => {
    const localSpy = vi.spyOn(localSource, 'listLocalStores')
    const bpSpy = vi.spyOn(bpSource, 'listBusinessPlatformStores')
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(listStores()).rejects.toThrow('An organization ID is required to list stores non-interactively.')
    expect(selectOrganizationFromList).not.toHaveBeenCalled()
    expect(bpSpy).not.toHaveBeenCalled()
    expect(localSpy).not.toHaveBeenCalled()
  })

  test('propagates organization prompt cancellation without falling back', async () => {
    const localSpy = vi.spyOn(localSource, 'listLocalStores')
    const bpSpy = vi.spyOn(bpSource, 'listBusinessPlatformStores')
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(selectOrganizationFromList).mockRejectedValue(new AbortError('User cancelled'))

    await expect(listStores()).rejects.toThrow('User cancelled')
    expect(bpSpy).not.toHaveBeenCalled()
    expect(localSpy).not.toHaveBeenCalled()
  })

  test('falls back to store-auth when the session cannot be resolved in auto mode', async () => {
    vi.spyOn(localSource, 'listLocalStores').mockReturnValue([localEntry])
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [],
      currentUserResolved: false,
    })

    const result = await listStores()

    expect(result).toEqual({
      stores: [localEntry],
      source: 'store-auth',
      notice:
        "Couldn't resolve a Shopify account for the current CLI session. Showing locally stored store auth instead.",
    })
  })

  test('returns an unresolved notice without fallback when organization source is explicit', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [],
      currentUserResolved: false,
    })

    const result = await listStores({source: 'organization'})

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: false})
    expect(fetchOrganizationsWithAccessInfo).toHaveBeenCalledWith('bp-token', {noPrompt: false})
    expect(result).toEqual({
      stores: [],
      source: 'organization',
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    })
  })

  test('returns an unresolved notice without fallback when organization id is set in auto mode', async () => {
    const localSpy = vi.spyOn(localSource, 'listLocalStores')
    const bpSpy = vi.spyOn(bpSource, 'listBusinessPlatformStores')
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [],
      currentUserResolved: false,
    })

    const result = await listStores({organizationId: '1234'})

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: true})
    expect(fetchOrganizationsWithAccessInfo).toHaveBeenCalledWith('bp-token', {noPrompt: true})
    expect(bpSpy).not.toHaveBeenCalled()
    expect(localSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      stores: [],
      source: 'organization',
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    })
  })

  test('falls back to store-auth when the organization listing is unavailable in auto mode', async () => {
    vi.spyOn(localSource, 'listLocalStores').mockReturnValue([localEntry])
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockRejectedValue(
      new AbortError('Access denied for accessibleShops'),
    )

    const result = await listStores()

    expect(result).toEqual({
      stores: [localEntry],
      source: 'store-auth',
      notice:
        "Couldn't list stores from your Shopify organization for the current CLI session. Showing locally stored store auth instead.",
    })
  })

  test('falls back to store-auth on a non-abort failure in auto mode', async () => {
    vi.spyOn(localSource, 'listLocalStores').mockReturnValue([localEntry])
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockRejectedValue(new Error('Network exploded'))

    const result = await listStores()

    expect(result).toEqual({
      stores: [localEntry],
      source: 'store-auth',
      notice:
        "Couldn't list stores from your Shopify organization for the current CLI session. Showing locally stored store auth instead.",
    })
  })

  test('rethrows unavailable errors when organization source is explicit', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockRejectedValue(
      new AbortError('Access denied for accessibleShops'),
    )

    await expect(listStores({source: 'organization'})).rejects.toThrow('Access denied for accessibleShops')
  })

  test('does not fall back to store-auth when --organization-id is set and listing fails', async () => {
    const localSpy = vi.spyOn(localSource, 'listLocalStores')
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockRejectedValue(
      new AbortError('Access denied for accessibleShops'),
    )

    await expect(listStores({organizationId: '1234'})).rejects.toThrow('Access denied for accessibleShops')
    expect(localSpy).not.toHaveBeenCalled()
  })

  test('returns an empty result when the current account has no organizations', async () => {
    mockOrganizations([])

    const result = await listStores()

    expect(result).toEqual({stores: [], source: 'organization'})
  })

  test('rejects a present-but-empty organization id', async () => {
    const spy = vi.spyOn(bpSource, 'listBusinessPlatformStores')

    await expect(listStores({organizationId: '  '})).rejects.toThrow('The `--organization-id` value is empty.')
    expect(spy).not.toHaveBeenCalled()
  })

  test('throws with the accessible organizations when the requested organization is not found', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores')

    await expect(listStores({organizationId: '9999999'})).rejects.toThrow('Organization with ID 9999999 not found.')
  })

  test('rejects --organization-id combined with the store-auth source', async () => {
    const spy = vi.spyOn(bpSource, 'listBusinessPlatformStores')

    await expect(listStores({source: 'store-auth', organizationId: '1234567'})).rejects.toThrow(
      "`--organization-id` can't be combined with `--from store-auth`.",
    )
    expect(spy).not.toHaveBeenCalled()
  })

  test('caps the organization listing at 250 entries and flags truncation when more were returned', async () => {
    mockOrganizations([acme])
    const entries = Array.from({length: 251}, (_unused, index) => ({
      store: `shop-${index}.myshopify.com`,
      createdAt: '2026-01-15T00:00:00Z',
      organizationId: '1234',
      organizationName: 'Acme',
    }))
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries})

    const result = await listStores()

    expect(result.stores).toHaveLength(250)
    expect(result.truncated).toBe(true)
  })

  test('caps the store-auth listing at 250 and flags truncation', async () => {
    const entries = Array.from({length: 260}, (_unused, index) => ({
      store: `shop-${index}.myshopify.com`,
      connectedAt: '2026-06-03T00:00:00Z',
    }))
    vi.spyOn(localSource, 'listLocalStores').mockReturnValue(entries)

    const result = await listStores({source: 'store-auth'})

    expect(result.source).toBe('store-auth')
    expect(result.stores).toHaveLength(250)
    expect(result.truncated).toBe(true)
  })

  test('flags truncation when the organization source reports more stores even under the limit', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: [orgEntry], hasMore: true})

    const result = await listStores()

    expect(result.stores).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  test('omits truncated when at or under the limit and nothing more remains', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: [orgEntry]})

    const result = await listStores()

    expect(result.truncated).toBeUndefined()
  })
})

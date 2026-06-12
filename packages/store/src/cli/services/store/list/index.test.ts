import {listStores} from './index.js'
import * as bpSource from './bp-source.js'
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
  test('returns organization results for the only available organization', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: [orgEntry]})

    const result = await listStores()

    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({token: 'bp-token', organization: acme})
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

    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({token: 'bp-token', organization: beta})
    expect(selectOrganizationFromList).toHaveBeenCalledWith([acme, beta], '5678')
  })

  test('uses the shared organization selector when multiple are available and no id is provided', async () => {
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(selectOrganizationFromList).mockResolvedValue(beta)
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({entries: []})

    const result = await listStores()

    expect(selectOrganizationFromList).toHaveBeenCalledWith([acme, beta], undefined)
    expect(bpSource.listBusinessPlatformStores).toHaveBeenCalledWith({token: 'bp-token', organization: beta})
    expect(result.organization).toEqual({id: '5678', name: 'Beta'})
  })

  test('requires an organization id non-interactively when multiple organizations are available', async () => {
    const spy = vi.spyOn(bpSource, 'listBusinessPlatformStores')
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(listStores()).rejects.toThrow('An organization ID is required to list stores non-interactively.')
    expect(selectOrganizationFromList).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  test('propagates organization prompt cancellation', async () => {
    const spy = vi.spyOn(bpSource, 'listBusinessPlatformStores')
    mockOrganizations([acme, beta])
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(selectOrganizationFromList).mockRejectedValue(new AbortError('User cancelled'))

    await expect(listStores()).rejects.toThrow('User cancelled')
    expect(spy).not.toHaveBeenCalled()
  })

  test('returns a notice when the current CLI session cannot be resolved to an account', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
    vi.mocked(fetchOrganizationsWithAccessInfo).mockResolvedValue({
      organizations: [],
      currentUserResolved: false,
    })

    const result = await listStores()

    expect(result).toEqual({
      stores: [],
      source: 'organization',
      notice: "Couldn't resolve a Shopify account for the current CLI session.",
    })
  })

  test('returns an empty result when the current account has no organizations', async () => {
    mockOrganizations([])

    const result = await listStores()

    expect(result).toEqual({stores: [], source: 'organization'})
  })

  test('propagates store listing failures', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockRejectedValue(
      new AbortError('Access denied for accessibleShops'),
    )

    await expect(listStores()).rejects.toThrow('Access denied for accessibleShops')
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

  test('caps the listing at 250 entries and flags truncation when more were returned', async () => {
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

  test('flags truncation when the source reports more stores even under the limit', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
      entries: [
        {store: 'shop.myshopify.com', createdAt: '2026-01-15T00:00:00Z', organizationId: '1', organizationName: 'Acme'},
      ],
      hasMore: true,
    })

    const result = await listStores()

    expect(result.stores).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  test('omits truncated when at or under the limit and nothing more remains', async () => {
    mockOrganizations([acme])
    vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
      entries: [
        {store: 'shop.myshopify.com', createdAt: '2026-01-15T00:00:00Z', organizationId: '1', organizationName: 'Acme'},
      ],
    })

    const result = await listStores()

    expect(result.truncated).toBeUndefined()
  })
})

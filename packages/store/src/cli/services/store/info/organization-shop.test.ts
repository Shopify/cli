import {fetchOrganizationShop} from './organization-shop.js'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {BugError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const SHOP = 'shop.myshopify.com'
const ORG_ID = '123'

function shopNode(overrides: Record<string, unknown> = {}) {
  return {
    shopifyShopId: '72193245184',
    name: 'My Shop',
    primaryDomain: `https://${SHOP}`,
    storeType: 'PRODUCTION',
    developerPreviewHandle: 'extended_variants',
    planName: 'professional',
    ownerDetails: {fullName: 'Jane Doe', email: 'jane@acme.com'},
    ...overrides,
  }
}

describe('fetchOrganizationShop', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('bp-token')
  })

  test('returns the matched shop node', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      organization: {
        id: 'gid',
        name: 'Acme',
        accessibleShops: {edges: [{node: shopNode()}]},
      },
    } as never)

    const shop = await fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})
    expect(shop.name).toBe('My Shop')
    expect(shop.primaryDomain).toBe(`https://${SHOP}`)
    expect(shop.shopifyShopId).toBe('72193245184')
    expect(shop.storeType).toBe('PRODUCTION')
    expect(shop.developerPreviewHandle).toBe('extended_variants')
    expect(shop.planName).toBe('professional')
    expect(shop.ownerName).toBe('Jane Doe')
    expect(shop.ownerEmail).toBe('jane@acme.com')
  })

  test('throws BugError when no shop matches the domain', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      organization: {
        id: 'gid',
        name: 'Acme',
        accessibleShops: {edges: [{node: shopNode({primaryDomain: 'https://other.myshopify.com'})}]},
      },
    } as never)

    await expect(fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})).rejects.toBeInstanceOf(BugError)
  })

  test('passes organizationId and search variable to the request', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      organization: {id: 'gid', name: 'Acme', accessibleShops: {edges: [{node: shopNode()}]}},
    } as never)

    await fetchOrganizationShop({store: SHOP, organizationId: ORG_ID, token: 'preset'})

    const call = vi.mocked(businessPlatformOrganizationsRequestDoc).mock.calls[0]?.[0]
    expect(call?.organizationId).toBe(ORG_ID)
    expect(call?.variables).toEqual({search: SHOP})
    expect(call?.token).toBe('preset')
    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
  })

  test('throws when organization is missing', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({organization: null} as never)
    await expect(fetchOrganizationShop({store: SHOP, organizationId: ORG_ID})).rejects.toBeInstanceOf(BugError)
  })
})

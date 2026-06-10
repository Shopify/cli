import {getStoreInfo} from './index.js'
import {fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, expect, vi} from 'vitest'
import type {OrganizationShopFields} from './types.js'
import type {Store} from '../../../api/graphql/business-platform-organizations/generated/types.js'

vi.mock('./destinations.js')
vi.mock('./organization-shop.js')

const SHOP = 'shop.myshopify.com'

function orgShop(overrides: Partial<OrganizationShopFields> = {}): OrganizationShopFields {
  return {
    shopifyShopId: '72193245184',
    name: 'My Shop (Org)',
    primaryDomain: `https://${SHOP}`,
    storeType: 'PRODUCTION',
    developerPreviewHandle: 'extended_variants',
    planName: 'professional',
    ownerName: 'Jane Doe',
    ownerEmail: 'jane@acme.com',
    ...overrides,
  }
}

describe('getStoreInfo', () => {
  test('throws AbortError when no store is provided', async () => {
    const err = await getStoreInfo({}).catch((error: unknown) => error)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain('No store')
  })

  test('composes fields from destinations + org-shop', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({
      owningOrg: {name: 'Acme Holdings', id: '149572536'},
    })
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())

    const result = await getStoreInfo({store: SHOP})

    expect(result).toEqual({
      id: 'gid://shopify/Shop/72193245184',
      displayName: 'My Shop (Org)',
      subdomain: SHOP,
      organizationId: '149572536',
      organizationName: 'Acme Holdings',
      storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'},
      type: 'production',
      plan: 'grow',
      featurePreview: 'extended_variants',
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })

  test('derives the admin URL from the myshopify subdomain', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop())

    const result = await getStoreInfo({store: 'acme-widgets.myshopify.com'})

    expect(result.adminUrl).toBe('https://admin.shopify.com/store/acme-widgets')
  })

  test('maps the raw plan name to a public handle', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop({planName: 'shopify_plus'}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.plan).toBe('plus')
  })

  test('omits the plan when the raw plan name is unrecognized', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop({planName: 'development_legacy'}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.plan).toBeUndefined()
  })

  test.each<[Store, string]>([
    ['APP_DEVELOPMENT', 'dev'],
    ['DEVELOPMENT', 'dev'],
    ['DEVELOPMENT_SUPERSET', 'dev'],
    ['PRODUCTION', 'production'],
    ['CLIENT_TRANSFER', 'client_transfer'],
    ['COLLABORATOR', 'collaborator'],
  ])('maps the %s store type to the `%s` handle', async (storeType, expected) => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop({storeType}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.type).toBe(expected)
  })

  test('omits the type for an unrecognized store type', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop({storeType: 'MANAGED_MARKETS' as Store}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.type).toBeUndefined()
  })

  test('omits storeOwner when neither name nor email is present', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValueOnce(orgShop({ownerName: undefined, ownerEmail: undefined}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.storeOwner).toBeUndefined()
  })

  test('omits org-sourced fields when the owning org is unknown', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({})

    const result = await getStoreInfo({store: SHOP})

    expect(fetchOrganizationShop).not.toHaveBeenCalled()
    expect(result).toEqual({
      subdomain: SHOP,
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })

  test('omits org-sourced fields without throwing when the org-shop lookup fails', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValueOnce({owningOrg: {name: 'Acme', id: '42'}})
    vi.mocked(fetchOrganizationShop).mockRejectedValueOnce(new Error('5xx'))

    const result = await getStoreInfo({store: SHOP})

    expect(result).toEqual({
      subdomain: SHOP,
      organizationId: '42',
      organizationName: 'Acme',
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })
})

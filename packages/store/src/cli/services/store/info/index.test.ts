import {getStoreInfo} from './index.js'
import {StoreInfoBusinessPlatformStoreNotFoundError, fetchDestinationsContext} from './destinations.js'
import {fetchOrganizationShop} from './organization-shop.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'
import {loadStoredStoreSession} from '../auth/session-lifecycle.js'
import {clearStoredStoreAppSession, getCurrentStoredStoreAppSession} from '../auth/session-store.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {claimPreviewStore, getPreviewStore} from '../create/preview/client.js'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {setLastSeenUserId} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, test, expect, vi} from 'vitest'
import type {OrganizationShopFields} from './types.js'
import type {Store} from '../../../api/graphql/business-platform-organizations/generated/types.js'

vi.mock('./destinations.js', async () => {
  const actual = await vi.importActual<typeof import('./destinations.js')>('./destinations.js')
  return {
    ...actual,
    fetchDestinationsContext: vi.fn(),
  }
})
vi.mock('./organization-shop.js')
vi.mock('../auth/session-lifecycle.js')
vi.mock('../auth/session-store.js')
vi.mock('../attribution.js')
vi.mock('../create/preview/client.js')
vi.mock('@shopify/cli-kit/node/api/graphql')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/api/admin')>(
    '@shopify/cli-kit/node/api/admin',
  )
  return {
    ...actual,
    adminUrl: vi.fn(),
  }
})

const SHOP = 'shop.myshopify.com'
const STORED_SESSION = {
  store: SHOP,
  clientId: STORE_AUTH_APP_CLIENT_ID,
  userId: '42',
  accessToken: 'token',
  refreshToken: 'refresh-token',
  scopes: ['read_products'],
  acquiredAt: '2026-04-02T00:00:00.000Z',
}

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

function adminShop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gid://shopify/Shop/72193245184',
    name: 'My Shop',
    myshopifyDomain: SHOP,
    email: 'jane@acme.com',
    shopOwnerName: 'Jane Doe',
    plan: {
      publicDisplayName: 'Grow',
      partnerDevelopment: false,
    },
    ...overrides,
  }
}

// Structural fake of graphql-request's `ClientError`; production matches on shape.
function makeClientErrorLike(status: number, message = 'GraphQL Error'): Error {
  const error = new Error(message) as Error & {response: {status: number; errors: {message: string}[]}}
  error.response = {status, errors: [{message}]}
  return error
}

function mockStoredStoreAuth(): void {
  vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(STORED_SESSION)
}

function mockBusinessPlatformUnavailable(
  error: Error = new StoreInfoBusinessPlatformStoreNotFoundError(
    `Couldn't find a store with domain ${SHOP} for the current account.`,
  ),
): void {
  vi.mocked(fetchDestinationsContext).mockRejectedValue(error)
}

function mockStoreAuthFallback(): void {
  mockStoredStoreAuth()
  mockBusinessPlatformUnavailable()
}

describe('getStoreInfo', () => {
  beforeEach(() => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValue(undefined)
    vi.mocked(fetchDestinationsContext).mockResolvedValue({owningOrg: {name: 'Acme Holdings', id: '149572536'}})
    vi.mocked(fetchOrganizationShop).mockResolvedValue(orgShop())
    vi.mocked(loadStoredStoreSession).mockResolvedValue(STORED_SESSION)
    vi.mocked(adminUrl).mockReturnValue(`https://${SHOP}/admin/api/unstable/graphql.json`)
    vi.mocked(graphqlRequest).mockResolvedValue({shop: adminShop()})
  })

  test('throws AbortError when no store is provided', async () => {
    const err = await getStoreInfo({}).catch((error: unknown) => error)
    expect(err).toBeInstanceOf(AbortError)
    expect((err as AbortError).message).toContain('No store')
    expect(fetchDestinationsContext).not.toHaveBeenCalled()
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
  })

  test('uses BP destinations and org-shop when there is no stored store auth session', async () => {
    const result = await getStoreInfo({store: SHOP})

    expect(getCurrentStoredStoreAppSession).toHaveBeenCalledWith(SHOP)
    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: SHOP, noPrompt: false})
    expect(fetchOrganizationShop).toHaveBeenCalledWith({store: SHOP, organizationId: '149572536', noPrompt: false})
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
    expect(graphqlRequest).not.toHaveBeenCalled()
    expect(claimPreviewStore).not.toHaveBeenCalled()
    expect(getPreviewStore).not.toHaveBeenCalled()
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

  test('returns fresh access and save URLs for locally stored preview stores', async () => {
    vi.mocked(getCurrentStoredStoreAppSession).mockReturnValueOnce({
      store: SHOP,
      clientId: STORE_AUTH_APP_CLIENT_ID,
      userId: 'preview:placeholder-uuid',
      accessToken: 'shpat_preview_token',
      scopes: [],
      acquiredAt: '2026-06-08T12:00:00.000Z',
      kind: 'preview',
      preview: {
        placeholderAccountUuid: 'placeholder-uuid',
        shopId: '123',
        name: 'Lavender Candles',
        createdAt: '2026-06-08T12:00:00.000Z',
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=stale-access-token',
      },
    })
    vi.mocked(claimPreviewStore).mockResolvedValueOnce({
      claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    })
    vi.mocked(getPreviewStore).mockResolvedValueOnce({
      shop: {id: '123', name: 'Lavender Candles', domain: SHOP},
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
    })

    const result = await getStoreInfo({store: SHOP})

    expect(fetchDestinationsContext).not.toHaveBeenCalled()
    expect(fetchOrganizationShop).not.toHaveBeenCalled()
    expect(claimPreviewStore).toHaveBeenCalledWith({
      shopId: '123',
      adminApiToken: 'shpat_preview_token',
    })
    expect(getPreviewStore).toHaveBeenCalledWith({
      shopId: '123',
      adminApiToken: 'shpat_preview_token',
    })
    expect(result).toEqual({
      id: 'gid://shopify/Shop/123',
      displayName: 'Lavender Candles',
      subdomain: SHOP,
      accessUrl: 'https://app.shopify.com/auth/preview-store?token=fresh-access-token',
      saveUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
    })
    // The admin URL doesn't resolve for an unclaimed preview store, so it's deliberately omitted.
    expect(result.adminUrl).toBeUndefined()
  })

  test('prefers BP when store auth exists and BP can resolve the store', async () => {
    mockStoredStoreAuth()

    const result = await getStoreInfo({store: SHOP})

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: SHOP, noPrompt: true})
    expect(fetchOrganizationShop).toHaveBeenCalledWith({store: SHOP, organizationId: '149572536', noPrompt: true})
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
    expect(graphqlRequest).not.toHaveBeenCalled()
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
    expect(claimPreviewStore).not.toHaveBeenCalled()
  })

  test('falls back to stored store auth when BP cannot resolve a store-auth store', async () => {
    mockStoreAuthFallback()

    const result = await getStoreInfo({store: SHOP})

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: SHOP, noPrompt: true})
    expect(fetchOrganizationShop).not.toHaveBeenCalled()
    expect(loadStoredStoreSession).toHaveBeenCalledWith(SHOP)
    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith(SHOP, true)
    expect(setLastSeenUserId).toHaveBeenCalledWith('42')
    expect(adminUrl).toHaveBeenCalledWith(SHOP, 'unstable')
    expect(graphqlRequest).toHaveBeenCalledWith({
      query: expect.stringContaining('query StoreInfoAdminShop'),
      api: 'Admin',
      url: `https://${SHOP}/admin/api/unstable/graphql.json`,
      token: 'token',
      responseOptions: {handleErrors: false},
    })
    expect(result).toEqual({
      id: 'gid://shopify/Shop/72193245184',
      displayName: 'My Shop',
      subdomain: SHOP,
      storeOwner: {name: 'Jane Doe', email: 'jane@acme.com'},
      plan: 'Grow',
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })

  test('falls back to stored store auth when BP auth would need to prompt', async () => {
    const noPromptError = new AbortError(`The currently available CLI credentials are invalid.

The CLI is currently unable to prompt for reauthentication.`)
    mockStoreAuthFallback()
    mockBusinessPlatformUnavailable(noPromptError)

    const result = await getStoreInfo({store: SHOP})

    expect(fetchDestinationsContext).toHaveBeenCalledWith({store: SHOP, noPrompt: true})
    expect(loadStoredStoreSession).toHaveBeenCalledWith(SHOP)
    expect(result.displayName).toBe('My Shop')
  })

  test('throws the BP error when BP cannot resolve a store and no store auth exists', async () => {
    mockBusinessPlatformUnavailable()

    await expect(getStoreInfo({store: SHOP})).rejects.toMatchObject({
      message: `Couldn't find a store with domain ${SHOP} for the current account.`,
    })
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
  })

  test('rethrows unexpected BP errors instead of falling back to stored store auth', async () => {
    mockStoredStoreAuth()
    vi.mocked(fetchDestinationsContext).mockRejectedValue(new Error('upstream exploded'))

    await expect(getStoreInfo({store: SHOP})).rejects.toThrow('upstream exploded')
    expect(loadStoredStoreSession).not.toHaveBeenCalled()
  })

  test('uses the refreshed session store returned by the stored-auth loader', async () => {
    mockStoreAuthFallback()
    vi.mocked(loadStoredStoreSession).mockResolvedValue({
      ...STORED_SESSION,
      store: 'permanent-shop.myshopify.com',
      accessToken: 'fresh-token',
    })
    vi.mocked(graphqlRequest).mockResolvedValue({
      shop: adminShop({myshopifyDomain: 'permanent-shop.myshopify.com'}),
    })

    const result = await getStoreInfo({store: SHOP})

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('permanent-shop.myshopify.com', true)
    expect(adminUrl).toHaveBeenCalledWith('permanent-shop.myshopify.com', 'unstable')
    expect(graphqlRequest).toHaveBeenCalledWith(expect.objectContaining({token: 'fresh-token'}))
    expect(result.subdomain).toBe('permanent-shop.myshopify.com')
    expect(result.adminUrl).toBe('https://admin.shopify.com/store/permanent-shop')
  })

  test('derives the admin URL from the Admin myshopify domain for store-auth stores', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockResolvedValue({
      shop: adminShop({myshopifyDomain: 'acme-widgets.myshopify.com'}),
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.subdomain).toBe('acme-widgets.myshopify.com')
    expect(result.adminUrl).toBe('https://admin.shopify.com/store/acme-widgets')
  })

  test('falls back to the stored session store when Admin omits myshopifyDomain', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockResolvedValue({
      shop: adminShop({myshopifyDomain: undefined}),
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.subdomain).toBe(SHOP)
    expect(result.adminUrl).toBe('https://admin.shopify.com/store/shop')
  })

  test('maps the BP raw plan name to a public handle', async () => {
    vi.mocked(fetchOrganizationShop).mockResolvedValue(orgShop({planName: 'shopify_plus'}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.plan).toBe('plus')
  })

  test('uses the Admin public plan display name for store-auth stores', async () => {
    mockStoreAuthFallback()

    const result = await getStoreInfo({store: SHOP})

    expect(result.plan).toBe('Grow')
  })

  test.each<[Store, string]>([
    ['APP_DEVELOPMENT', 'dev'],
    ['DEVELOPMENT', 'dev'],
    ['DEVELOPMENT_SUPERSET', 'dev'],
    ['PRODUCTION', 'production'],
    ['CLIENT_TRANSFER', 'client_transfer'],
    ['COLLABORATOR', 'collaborator'],
  ])('maps the BP %s store type to the `%s` handle', async (storeType, expected) => {
    vi.mocked(fetchOrganizationShop).mockResolvedValue(orgShop({storeType}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.type).toBe(expected)
  })

  test('marks type as dev when the Admin plan identifies a partner development store', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockResolvedValue({
      shop: adminShop({plan: {publicDisplayName: 'Development', partnerDevelopment: true}}),
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.type).toBe('dev')
    expect(result.plan).toBe('Development')
  })

  test('omits type when the Admin plan does not identify a development store', async () => {
    mockStoreAuthFallback()

    const result = await getStoreInfo({store: SHOP})

    expect(result.type).toBeUndefined()
  })

  test('omits storeOwner when neither Admin name nor email is present', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockResolvedValue({
      shop: adminShop({shopOwnerName: undefined, email: undefined}),
    })

    const result = await getStoreInfo({store: SHOP})

    expect(result.storeOwner).toBeUndefined()
  })

  test('omits storeOwner when neither BP name nor email is present', async () => {
    vi.mocked(fetchOrganizationShop).mockResolvedValue(orgShop({ownerName: undefined, ownerEmail: undefined}))

    const result = await getStoreInfo({store: SHOP})

    expect(result.storeOwner).toBeUndefined()
  })

  test('omits org-sourced fields when the owning org is unknown in the BP path', async () => {
    vi.mocked(fetchDestinationsContext).mockResolvedValue({})

    const result = await getStoreInfo({store: SHOP})

    expect(fetchOrganizationShop).not.toHaveBeenCalled()
    expect(result).toEqual({
      subdomain: SHOP,
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })

  test('omits org-sourced fields without throwing when the BP org-shop lookup fails', async () => {
    vi.mocked(fetchOrganizationShop).mockRejectedValue(new Error('5xx'))

    const result = await getStoreInfo({store: SHOP})

    expect(result).toEqual({
      subdomain: SHOP,
      organizationId: '149572536',
      organizationName: 'Acme Holdings',
      adminUrl: 'https://admin.shopify.com/store/shop',
    })
  })

  test('throws when Shopify does not return Admin shop info', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockResolvedValue({shop: undefined})

    await expect(getStoreInfo({store: SHOP})).rejects.toThrow(`Shopify did not return store information for ${SHOP}.`)
  })

  test('clears stored auth and throws a re-auth error on Admin 401', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(401, 'Unauthorized'))

    await expect(getStoreInfo({store: SHOP})).rejects.toMatchObject({
      message: `Stored app authentication for ${SHOP} is no longer valid.`,
      tryMessage: 'To re-authenticate, run:',
      nextSteps: [[{command: `shopify store auth --store ${SHOP} --scopes read_products`}]],
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(SHOP, '42')
  })

  test('also treats Admin 404 as a stored-auth-no-longer-valid signal', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(404, 'Not Found'))

    await expect(getStoreInfo({store: SHOP})).rejects.toMatchObject({
      message: `Stored app authentication for ${SHOP} is no longer valid.`,
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith(SHOP, '42')
  })

  test('maps unavailable Admin stores to a user-facing AbortError', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockRejectedValue(makeClientErrorLike(402, 'Unavailable Shop'))

    let captured: AbortError | undefined
    await getStoreInfo({store: SHOP}).catch((error) => {
      captured = error as AbortError
    })

    expect(captured).toBeInstanceOf(AbortError)
    expect(captured).not.toBeInstanceOf(BugError)
    expect(captured?.message).toBe(`The store ${SHOP} is currently unavailable.`)
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('rethrows unrelated Admin API errors', async () => {
    mockStoreAuthFallback()
    vi.mocked(graphqlRequest).mockRejectedValue(new Error('upstream exploded'))

    await expect(getStoreInfo({store: SHOP})).rejects.toThrow('upstream exploded')
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })
})

import {createStore} from './index.js'
import {signupsRequest} from '@shopify/cli-kit/node/api/signups'
import {businessPlatformOrganizationsRequest} from '@shopify/cli-kit/node/api/business-platform'
import {
  ensureAuthenticatedSignups,
  ensureAuthenticatedAppManagementAndBusinessPlatform,
} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/signups')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

describe('createStore', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedSignups).mockResolvedValue({token: 'test-token', userId: 'user-1'})
    vi.mocked(ensureAuthenticatedAppManagementAndBusinessPlatform).mockResolvedValue({
      appManagementToken: 'app-token',
      businessPlatformToken: 'bp-token',
      userId: 'user-1',
    })
  })

  describe('trial store (dev: false)', () => {
    test('creates a trial store with minimal input and returns the result', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: 'my-store.myshopify.com',
          polling: false,
          shopLoginUrl: 'https://my-store.myshopify.com/admin',
          userErrors: [],
        },
      })

      const result = await createStore({country: 'US', dev: false, forClient: false})

      expect(signupsRequest).toHaveBeenCalledWith(expect.stringContaining('StoreCreate'), 'test-token', {
        signup: {country: 'US'},
      })
      expect(result).toEqual({
        shopPermanentDomain: 'my-store.myshopify.com',
        polling: false,
        shopLoginUrl: 'https://my-store.myshopify.com/admin',
      })
    })

    test('passes name and subdomain to the StoreCreate mutation', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: 'my-custom.myshopify.com',
          polling: false,
          shopLoginUrl: null,
          userErrors: [],
        },
      })

      const result = await createStore({
        name: 'My Custom Store',
        subdomain: 'my-custom',
        country: 'CA',
        dev: false,
        forClient: false,
      })

      expect(signupsRequest).toHaveBeenCalledWith(expect.stringContaining('StoreCreate'), 'test-token', {
        signup: {shopName: 'My Custom Store', subdomain: 'my-custom', country: 'CA'},
      })
      expect(result.shopPermanentDomain).toBe('my-custom.myshopify.com')
    })

    test('returns polling as true when the store is still being configured', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: 'async-store.myshopify.com',
          polling: true,
          shopLoginUrl: null,
          userErrors: [],
        },
      })

      const result = await createStore({country: 'US', dev: false, forClient: false})

      expect(result.polling).toBe(true)
    })

    test('coerces null polling to false', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: 'store.myshopify.com',
          polling: null,
          shopLoginUrl: null,
          userErrors: [],
        },
      })

      const result = await createStore({country: 'US', dev: false, forClient: false})

      expect(result.polling).toBe(false)
    })

    test('throws an AbortError with field context when the API returns user errors', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: null,
          polling: null,
          shopLoginUrl: null,
          userErrors: [{field: ['signup', 'subdomain'], message: 'Subdomain is already taken'}],
        },
      })

      await expect(createStore({subdomain: 'taken', country: 'US', dev: false, forClient: false})).rejects.toThrow(
        'signup.subdomain: Subdomain is already taken',
      )
    })

    test('throws an AbortError joining multiple user errors', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {
          shopPermanentDomain: null,
          polling: null,
          shopLoginUrl: null,
          userErrors: [
            {field: ['signup', 'subdomain'], message: 'Subdomain is already taken'},
            {field: null, message: 'Account limit reached'},
          ],
        },
      })

      await expect(createStore({country: 'US', dev: false, forClient: false})).rejects.toThrow(
        'signup.subdomain: Subdomain is already taken\nAccount limit reached',
      )
    })

    test('throws an AbortError when no domain is returned despite no user errors', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {shopPermanentDomain: null, polling: null, shopLoginUrl: null, userErrors: []},
      })

      await expect(createStore({country: 'US', dev: false, forClient: false})).rejects.toThrow('no domain returned')
    })

    test('throws an AbortError when storeCreate response is null', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({storeCreate: null})

      await expect(createStore({country: 'US', dev: false, forClient: false})).rejects.toThrow(
        'Unexpected response from Signups API',
      )
    })
  })

  describe('development store (dev: true)', () => {
    test('calls AppDevelopmentStoreCreate mutation with correct variables', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        appDevelopmentStoreCreate: {
          permanentDomain: 'dev-store.myshopify.com',
          loginUrl: 'https://admin.shopify.com/login?returnPath=/store/dev-store',
          shopId: 'gid://shopify/Shop/1',
          userErrors: [],
        },
      })

      const result = await createStore({name: 'Dev Store', country: 'US', dev: true, forClient: false})

      expect(signupsRequest).toHaveBeenCalledWith(expect.stringContaining('AppDevelopmentStoreCreate'), 'test-token', {
        shopInformation: {
          shopName: 'Dev Store',
          country: 'US',
          priceLookupKey: 'BASIC_APP_DEVELOPMENT',
          ipAddress: expect.any(String),
          userAgent: 'Shopify CLI',
        },
      })
      expect(result).toEqual({
        shopPermanentDomain: 'dev-store.myshopify.com',
        polling: false,
        shopLoginUrl: 'https://admin.shopify.com/login?returnPath=/store/dev-store',
      })
    })

    test('throws an AbortError when the API returns user errors for dev store', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        appDevelopmentStoreCreate: {
          permanentDomain: null,
          loginUrl: null,
          shopId: null,
          userErrors: [{field: ['shop_information', 'country'], message: 'Invalid country code'}],
        },
      })

      await expect(createStore({country: 'XX', dev: true, forClient: false})).rejects.toThrow(
        'shop_information.country: Invalid country code',
      )
    })

    test('throws an AbortError when no domain is returned for dev store', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        appDevelopmentStoreCreate: {permanentDomain: null, loginUrl: null, shopId: null, userErrors: []},
      })

      await expect(createStore({country: 'US', dev: true, forClient: false})).rejects.toThrow(
        'Development store creation failed: no domain returned',
      )
    })

    test('defaults shopName to "Dev Store" when no name is provided', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        appDevelopmentStoreCreate: {
          permanentDomain: 'random-domain.myshopify.com',
          loginUrl: null,
          shopId: 'gid://shopify/Shop/2',
          userErrors: [],
        },
      })

      await createStore({country: 'US', dev: true, forClient: false})

      expect(signupsRequest).toHaveBeenCalledWith(
        expect.stringContaining('AppDevelopmentStoreCreate'),
        'test-token',
        expect.objectContaining({shopInformation: expect.objectContaining({shopName: 'Dev Store'})}),
      )
    })

    test('throws an AbortError when appDevelopmentStoreCreate response is null', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({appDevelopmentStoreCreate: null})

      await expect(createStore({country: 'US', dev: true, forClient: false})).rejects.toThrow(
        'Unexpected response from Signups API',
      )
    })
  })

  describe('client transfer store (forClient: true)', () => {
    test('calls Organizations API CreateClientDevelopmentShop with correct variables', async () => {
      vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValue({
        createClientDevelopmentShop: {
          shopDomain: 'client-store.myshopify.com',
          shopAdminUrl: 'https://admin.shopify.com/store/client-store',
          userErrors: [],
        },
      })

      const result = await createStore({
        name: 'Client Store',
        country: 'CA',
        dev: false,
        forClient: true,
        org: '12345',
      })

      expect(businessPlatformOrganizationsRequest).toHaveBeenCalledWith({
        query: expect.stringContaining('CreateClientDevelopmentShop'),
        token: 'bp-token',
        organizationId: '12345',
        unauthorizedHandler: expect.any(Object),
      })
      expect(result).toEqual({
        shopPermanentDomain: 'client-store.myshopify.com',
        polling: false,
        shopLoginUrl: 'https://admin.shopify.com/store/client-store',
      })
    })

    test('defaults shopName to "Client Store" when no name is provided', async () => {
      vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValue({
        createClientDevelopmentShop: {
          shopDomain: 'client-store.myshopify.com',
          shopAdminUrl: null,
          userErrors: [],
        },
      })

      await createStore({country: 'US', dev: false, forClient: true, org: '12345'})

      expect(businessPlatformOrganizationsRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('shopName: "Client Store"').valueOf()
            ? expect.stringContaining('CreateClientDevelopmentShop')
            : expect.anything(),
        }),
      )
    })

    test('throws an AbortError when the API returns user errors', async () => {
      vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValue({
        createClientDevelopmentShop: {
          shopDomain: null,
          shopAdminUrl: null,
          userErrors: [{field: null, message: 'Only Partner organizations can create client development shops'}],
        },
      })

      await expect(createStore({country: 'US', dev: false, forClient: true, org: '12345'})).rejects.toThrow(
        'Only Partner organizations can create client development shops',
      )
    })

    test('throws an AbortError when no domain is returned', async () => {
      vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValue({
        createClientDevelopmentShop: {shopDomain: null, shopAdminUrl: null, userErrors: []},
      })

      await expect(createStore({country: 'US', dev: false, forClient: true, org: '12345'})).rejects.toThrow(
        'Client transfer store creation failed: no domain returned',
      )
    })

    test('throws an AbortError when createClientDevelopmentShop response is null', async () => {
      vi.mocked(businessPlatformOrganizationsRequest).mockResolvedValue({createClientDevelopmentShop: null})

      await expect(createStore({country: 'US', dev: false, forClient: true, org: '12345'})).rejects.toThrow(
        'Unexpected response from Organizations API',
      )
    })
  })

  describe('flag validation', () => {
    test('throws when --subdomain is used with --dev', async () => {
      await expect(createStore({subdomain: 'my-store', country: 'US', dev: true, forClient: false})).rejects.toThrow(
        'The --subdomain flag is not supported when creating a development store.',
      )
      expect(ensureAuthenticatedSignups).not.toHaveBeenCalled()
    })

    test('throws when --subdomain is used with --for-client', async () => {
      await expect(
        createStore({subdomain: 'my-store', country: 'US', dev: false, forClient: true, org: '12345'}),
      ).rejects.toThrow('The --subdomain flag is not supported when creating a client transfer store.')
    })

    test('throws when --for-client is used without --org', async () => {
      await expect(createStore({country: 'US', dev: false, forClient: true})).rejects.toThrow(
        'The --org flag is required when creating a client transfer store.',
      )
    })

    test('throws when --for-client and --dev are used together', async () => {
      await expect(createStore({country: 'US', dev: true, forClient: true, org: '12345'})).rejects.toThrow(
        "The --for-client and --dev flags can't be used together.",
      )
    })
  })

  test('propagates authentication failures from ensureAuthenticatedSignups', async () => {
    vi.mocked(ensureAuthenticatedSignups).mockRejectedValue(new Error('Authentication required'))

    await expect(createStore({country: 'US', dev: false, forClient: false})).rejects.toThrow('Authentication required')
  })
})

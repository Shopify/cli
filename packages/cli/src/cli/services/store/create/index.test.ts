import {createStore} from './index.js'
import {signupsRequest} from '@shopify/cli-kit/node/api/signups'
import {ensureAuthenticatedSignups} from '@shopify/cli-kit/node/session'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/signups')
vi.mock('@shopify/cli-kit/node/session')

describe('createStore', () => {
  beforeEach(() => {
    vi.mocked(ensureAuthenticatedSignups).mockResolvedValue({token: 'test-token', userId: 'user-1'})
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

      const result = await createStore({country: 'US', dev: false})

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

      const result = await createStore({name: 'My Custom Store', subdomain: 'my-custom', country: 'CA', dev: false})

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

      const result = await createStore({country: 'US', dev: false})

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

      const result = await createStore({country: 'US', dev: false})

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

      await expect(createStore({subdomain: 'taken', country: 'US', dev: false})).rejects.toThrow(
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

      await expect(createStore({country: 'US', dev: false})).rejects.toThrow(
        'signup.subdomain: Subdomain is already taken\nAccount limit reached',
      )
    })

    test('throws an AbortError when no domain is returned despite no user errors', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        storeCreate: {shopPermanentDomain: null, polling: null, shopLoginUrl: null, userErrors: []},
      })

      await expect(createStore({country: 'US', dev: false})).rejects.toThrow('no domain returned')
    })

    test('throws an AbortError when storeCreate response is null', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({storeCreate: null})

      await expect(createStore({country: 'US', dev: false})).rejects.toThrow('Unexpected response from Signups API')
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

      const result = await createStore({name: 'Dev Store', country: 'US', dev: true})

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

      await expect(createStore({country: 'XX', dev: true})).rejects.toThrow(
        'shop_information.country: Invalid country code',
      )
    })

    test('throws an AbortError when no domain is returned for dev store', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({
        appDevelopmentStoreCreate: {
          permanentDomain: null,
          loginUrl: null,
          shopId: null,
          userErrors: [],
        },
      })

      await expect(createStore({country: 'US', dev: true})).rejects.toThrow(
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

      await createStore({country: 'US', dev: true})

      expect(signupsRequest).toHaveBeenCalledWith(
        expect.stringContaining('AppDevelopmentStoreCreate'),
        'test-token',
        expect.objectContaining({shopInformation: expect.objectContaining({shopName: 'Dev Store'})}),
      )
    })

    test('throws an AbortError when appDevelopmentStoreCreate response is null', async () => {
      vi.mocked(signupsRequest).mockResolvedValue({appDevelopmentStoreCreate: null})

      await expect(createStore({country: 'US', dev: true})).rejects.toThrow('Unexpected response from Signups API')
    })
  })

  test('throws an AbortError when --subdomain is used with --dev', async () => {
    await expect(createStore({subdomain: 'my-store', country: 'US', dev: true})).rejects.toThrow(
      'The --subdomain flag is not supported when creating a development store.',
    )
    expect(ensureAuthenticatedSignups).not.toHaveBeenCalled()
  })

  test('propagates authentication failures from ensureAuthenticatedSignups', async () => {
    vi.mocked(ensureAuthenticatedSignups).mockRejectedValue(new Error('Authentication required'))

    await expect(createStore({country: 'US', dev: false})).rejects.toThrow('Authentication required')
  })
})

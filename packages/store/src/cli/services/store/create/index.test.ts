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

  test('creates a trial store with minimal input and returns the result', async () => {
    vi.mocked(signupsRequest).mockResolvedValue({
      storeCreate: {
        shopPermanentDomain: 'my-store.myshopify.com',
        polling: false,
        shopLoginUrl: 'https://my-store.myshopify.com/admin',
        userErrors: [],
      },
    })

    const result = await createStore({country: 'US'})

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

    const result = await createStore({name: 'My Custom Store', subdomain: 'my-custom', country: 'CA'})

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

    const result = await createStore({country: 'US'})

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

    const result = await createStore({country: 'US'})

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

    await expect(createStore({subdomain: 'taken', country: 'US'})).rejects.toThrow(
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

    await expect(createStore({country: 'US'})).rejects.toThrow(
      'signup.subdomain: Subdomain is already taken\nAccount limit reached',
    )
  })

  test('throws an AbortError when no domain is returned despite no user errors', async () => {
    vi.mocked(signupsRequest).mockResolvedValue({
      storeCreate: {shopPermanentDomain: null, polling: null, shopLoginUrl: null, userErrors: []},
    })

    await expect(createStore({country: 'US'})).rejects.toThrow('no domain returned')
  })

  test('throws an AbortError when storeCreate response is null', async () => {
    vi.mocked(signupsRequest).mockResolvedValue({storeCreate: null})

    await expect(createStore({country: 'US'})).rejects.toThrow('Unexpected response from Signups API')
  })

  test('propagates authentication failures from ensureAuthenticatedSignups', async () => {
    vi.mocked(ensureAuthenticatedSignups).mockRejectedValue(new Error('Authentication required'))

    await expect(createStore({country: 'US'})).rejects.toThrow('Authentication required')
  })
})

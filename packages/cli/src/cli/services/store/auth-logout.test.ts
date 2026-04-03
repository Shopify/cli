import {beforeEach, describe, expect, test, vi} from 'vitest'
import {clearStoredStoreAppSession, getStoredStoreAppSession} from './session.js'
import {displayStoreAuthLogout, logoutStoreAuth} from './auth-logout.js'
import {outputCompleted, outputInfo, outputResult} from '@shopify/cli-kit/node/output'

vi.mock('./session.js')
vi.mock('@shopify/cli-kit/node/output')

describe('store auth logout service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('clears the locally stored auth bucket for the store', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'token',
      refreshToken: 'refresh-token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      associatedUser: {id: 42, email: 'merchant@example.com'},
    } as any)

    expect(logoutStoreAuth('shop.myshopify.com')).toEqual({
      store: 'shop.myshopify.com',
      cleared: true,
    })
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('normalizes the store before looking up local auth', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue(undefined)

    expect(logoutStoreAuth('https://shop.myshopify.com/admin')).toEqual({
      store: 'shop.myshopify.com',
      cleared: false,
    })
    expect(getStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('normalizes the store before clearing local auth', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)

    expect(logoutStoreAuth('https://shop.myshopify.com/admin')).toEqual({
      store: 'shop.myshopify.com',
      cleared: true,
    })
    expect(getStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('returns a no-op result when no stored auth exists', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue(undefined)

    expect(logoutStoreAuth('shop.myshopify.com')).toEqual({
      store: 'shop.myshopify.com',
      cleared: false,
    })
    expect(clearStoredStoreAppSession).not.toHaveBeenCalled()
  })

  test('renders a completion message when stored auth is cleared', () => {
    displayStoreAuthLogout({
      store: 'shop.myshopify.com',
      cleared: true,
    })

    expect(outputCompleted).toHaveBeenCalledWith('Cleared locally stored store auth for shop.myshopify.com.')
  })

  test('renders an info message when there is nothing to clear', () => {
    displayStoreAuthLogout({
      store: 'shop.myshopify.com',
      cleared: false,
    })

    expect(outputInfo).toHaveBeenCalledWith('No locally stored store auth found for shop.myshopify.com.')
  })

  test('renders json output', () => {
    displayStoreAuthLogout(
      {
        store: 'shop.myshopify.com',
        cleared: true,
      },
      'json',
    )

    expect(outputResult).toHaveBeenCalledWith(`{
  "store": "shop.myshopify.com",
  "cleared": true
}`)
  })

  test('clears all locally stored users for the store so logout leaves no active session', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '84',
      accessToken: 'token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)

    logoutStoreAuth('shop.myshopify.com')

    expect(clearStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
  })
})

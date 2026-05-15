import {importStoreAuthBootstrap} from './bootstrap.js'
import {setStoredStoreAppSession} from './session-store.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./session-store.js')

describe('importStoreAuthBootstrap', () => {
  test('persists the provided store auth bootstrap through the normal store session seam', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))

    importStoreAuthBootstrap({
      userId: 'placeholder-user-id',
      bootstrap: {
        accessToken: 'store-access-token',
        scopes: ['read_products'],
        apiKey: 'development-shop-merchant-key',
        shopDomain: 'preview-shop',
      },
    })

    expect(setStoredStoreAppSession).toHaveBeenCalledWith({
      store: 'preview-shop.myshopify.com',
      clientId: 'development-shop-merchant-key',
      userId: 'placeholder-user-id',
      accessToken: 'store-access-token',
      refreshToken: undefined,
      scopes: ['read_products'],
      acquiredAt: '2026-05-14T12:00:00.000Z',
      expiresAt: undefined,
      refreshTokenExpiresAt: undefined,
      associatedUser: undefined,
    })

    vi.useRealTimers()
  })

  test('preserves fully qualified preview api hosts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))

    importStoreAuthBootstrap({
      userId: 'placeholder-user-id',
      bootstrap: {
        accessToken: 'store-access-token',
        scopes: ['read_products'],
        apiKey: 'development-shop-merchant-key',
        shopDomain: 'preview-shop.dev-api.shop.dev',
      },
    })

    expect(setStoredStoreAppSession).toHaveBeenCalledWith(expect.objectContaining({
      store: 'preview-shop.dev-api.shop.dev',
    }))

    vi.useRealTimers()
  })
})

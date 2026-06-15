import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoredStoreAppSession,
} from './session-store.js'
import {describe, test, expect} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

function inMemoryStorage() {
  const values = new Map<string, unknown>()

  return {
    get(key: string) {
      return values.get(key) as any
    },
    set(key: string, value: unknown) {
      values.set(key, value)
    },
    delete(key: string) {
      values.delete(key)
    },
  } as LocalStorage<Record<string, unknown>>
}

function buildSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'shop.myshopify.com',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token-1',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  }
}

describe('store session storage', () => {
  test('returns the current user session for a store', () => {
    const storage = inMemoryStorage()

    setStoredStoreAppSession(buildSession(), storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(buildSession())
  })

  test('keeps multiple user sessions per store and returns the current one', () => {
    const storage = inMemoryStorage()
    const firstSession = buildSession({userId: '42', accessToken: 'token-1'})
    const secondSession = buildSession({userId: '84', accessToken: 'token-2'})

    setStoredStoreAppSession(firstSession, storage as any)
    setStoredStoreAppSession(secondSession, storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(secondSession)
  })

  test('clears all stored sessions for a store', () => {
    const storage = inMemoryStorage()

    setStoredStoreAppSession(buildSession(), storage as any)
    clearStoredStoreAppSession('shop.myshopify.com', storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
  })

  test('clears only the specified user session and preserves the rest of the bucket', () => {
    const storage = inMemoryStorage()
    const firstSession = buildSession({userId: '42', accessToken: 'token-1'})
    const secondSession = buildSession({userId: '84', accessToken: 'token-2'})

    setStoredStoreAppSession(firstSession, storage as any)
    setStoredStoreAppSession(secondSession, storage as any)
    clearStoredStoreAppSession('shop.myshopify.com', '84', storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(firstSession)
  })

  test('returns undefined and clears the bucket when the current user session is missing', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '999',
      sessionsByUserId: {
        '42': buildSession(),
      },
    })

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })

  test('returns undefined and clears corrupted stored buckets', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: 42,
      sessionsByUserId: null,
    })

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })

  test('returns undefined and clears the bucket when the current stored session is malformed', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: {
        '42': {userId: '42'},
      },
    })

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })

  test('drops malformed optional fields from a stored session instead of rejecting the whole session', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: {
        '42': {
          ...buildSession(),
          refreshToken: 123,
          expiresAt: 456,
          refreshTokenExpiresAt: true,
          associatedUser: {
            id: 42,
            email: 123,
            firstName: 'Merchant',
            lastName: false,
            accountOwner: 'yes',
          },
        },
      },
    })

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual({
      ...buildSession(),
      associatedUser: {
        id: 42,
        firstName: 'Merchant',
      },
    })
  })

  test('overwrites a malformed bucket when writing a new session', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: null,
    })

    setStoredStoreAppSession(buildSession(), storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(buildSession())
  })

  test('clears malformed buckets without throwing when removing a specific user', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: null,
    })

    expect(() => clearStoredStoreAppSession('shop.myshopify.com', '42', storage as any)).not.toThrow()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })
})

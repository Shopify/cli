import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './auth-config.js'
import {
  clearStoredStoreAppSession,
  getStoredStoreAppSession,
  setStoredStoreAppSession,
  isSessionExpired,
  type StoredStoreAppSession,
} from './session.js'
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

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(buildSession())
  })

  test('keeps multiple user sessions per store and returns the current one', () => {
    const storage = inMemoryStorage()
    const firstSession = buildSession({userId: '42', accessToken: 'token-1'})
    const secondSession = buildSession({userId: '84', accessToken: 'token-2'})

    setStoredStoreAppSession(firstSession, storage as any)
    setStoredStoreAppSession(secondSession, storage as any)

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(secondSession)
  })

  test('clears all stored sessions for a store', () => {
    const storage = inMemoryStorage()

    setStoredStoreAppSession(buildSession(), storage as any)
    clearStoredStoreAppSession('shop.myshopify.com', storage as any)

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
  })

  test('clears only the specified user session and preserves the rest of the bucket', () => {
    const storage = inMemoryStorage()
    const firstSession = buildSession({userId: '42', accessToken: 'token-1'})
    const secondSession = buildSession({userId: '84', accessToken: 'token-2'})

    setStoredStoreAppSession(firstSession, storage as any)
    setStoredStoreAppSession(secondSession, storage as any)
    clearStoredStoreAppSession('shop.myshopify.com', '84', storage as any)

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(firstSession)
  })

  test('returns undefined and clears the bucket when the current user session is missing', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '999',
      sessionsByUserId: {
        '42': buildSession(),
      },
    })

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })

  test('returns undefined and clears corrupted stored buckets', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: 42,
      sessionsByUserId: null,
    })

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
  })
})

describe('isSessionExpired', () => {
  test('returns false when expiresAt is not set', () => {
    expect(isSessionExpired(buildSession())).toBe(false)
  })

  test('returns false when token is still valid', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: future}))).toBe(false)
  })

  test('returns true when token is expired', () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: past}))).toBe(true)
  })

  test('returns true within the 4-minute expiry margin', () => {
    const almostExpired = new Date(Date.now() + 3 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: almostExpired}))).toBe(true)
  })

  test('returns false just outside the 4-minute expiry margin', () => {
    const safelyValid = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    expect(isSessionExpired(buildSession({expiresAt: safelyValid}))).toBe(false)
  })

  test('returns true when expiresAt is invalid', () => {
    expect(isSessionExpired(buildSession({expiresAt: 'not-a-date'}))).toBe(true)
  })
})

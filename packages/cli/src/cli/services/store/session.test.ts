import {describe, test, expect} from 'vitest'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {
  clearStoredStoreAppSession,
  getStoredStoreAppSession,
  setStoredStoreAppSession,
  type StoredStoreAppSession,
} from './session.js'

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
    clientId: '4c6af92692662b9c95c8a47b1520aced',
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

  test('returns undefined when the current user session is missing from the bucket', () => {
    const storage = inMemoryStorage()
    storage.set('4c6af92692662b9c95c8a47b1520aced::shop.myshopify.com', {
      currentUserId: '999',
      sessionsByUserId: {
        '42': buildSession(),
      },
    })

    expect(getStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
  })
})

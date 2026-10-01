import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  getStoreAuthAdminSession,
  setStoredStoreAppSession,
  storeAuthSessionKey,
  type StoredStoreAppSession,
} from './store-auth-session.js'
import {STORE_AUTH_APP_CLIENT_ID} from './constants.js'
import {LocalStorage} from './local-storage.js'
import {inTemporaryDirectory} from './fs.js'
import {setLastSeenUserId} from './session.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./session.js', async () => {
  const actual = await vi.importActual<typeof import('./session.js')>('./session.js')
  return {
    ...actual,
    setLastSeenUserId: vi.fn(),
  }
})

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

describe('store auth session storage', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-06-08T12:00:00.000Z'))
  })

  test('escapes dotted and backslash key segments', () => {
    expect(storeAuthSessionKey('shop.myshopify.com\\evil')).toBe(
      `${STORE_AUTH_APP_CLIENT_ID}::shop\\.myshopify\\.com\\\\evil`,
    )
  })

  test('returns an Admin session from the current stored store auth session', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})
      storage.set(storeAuthSessionKey('preview.myshopify.com'), {
        currentUserId: 'preview:123',
        sessionsByUserId: {
          'preview:123': {
            store: 'preview.myshopify.com',
            clientId: STORE_AUTH_APP_CLIENT_ID,
            userId: 'preview:123',
            accessToken: 'shpat_token',
            scopes: [],
            acquiredAt: '2026-06-08T11:00:00.000Z',
          },
        },
      })

      expect(getStoreAuthAdminSession('https://preview.myshopify.com/admin', storage as any)).toEqual({
        token: 'shpat_token',
        storeFqdn: 'preview.myshopify.com',
      })
      expect(setLastSeenUserId).toHaveBeenCalledWith('preview:123')
    })
  })

  test('returns undefined when no stored store auth session exists', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})

      expect(getStoreAuthAdminSession('preview.myshopify.com', storage as any)).toBeUndefined()
      expect(setLastSeenUserId).not.toHaveBeenCalled()
    })
  })

  test('returns undefined when the current stored store auth session is expired', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})
      storage.set(storeAuthSessionKey('preview.myshopify.com'), {
        currentUserId: 'preview:123',
        sessionsByUserId: {
          'preview:123': {
            store: 'preview.myshopify.com',
            clientId: STORE_AUTH_APP_CLIENT_ID,
            userId: 'preview:123',
            accessToken: 'shpat_token',
            scopes: [],
            acquiredAt: '2026-06-08T11:00:00.000Z',
            expiresAt: '2026-06-08T11:30:00.000Z',
          },
        },
      })

      expect(getStoreAuthAdminSession('preview.myshopify.com', storage as any)).toBeUndefined()
      expect(setLastSeenUserId).not.toHaveBeenCalled()
    })
  })

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

  test('round-trips preview store session metadata', () => {
    const storage = inMemoryStorage()
    const previewSession = buildSession({
      userId: 'preview:placeholder-uuid',
      scopes: [],
      kind: 'preview',
      preview: {
        placeholderAccountUuid: 'placeholder-uuid',
        shopId: '123',
        name: 'Lavender Candles',
        country: 'US',
        createdAt: '2026-06-08T12:00:00.000Z',
      },
    })

    setStoredStoreAppSession(previewSession, storage as any)

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toEqual(previewSession)
  })

  test('rejects preview store sessions with malformed metadata', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: 'preview:placeholder-uuid',
      sessionsByUserId: {
        'preview:placeholder-uuid': {
          ...buildSession({userId: 'preview:placeholder-uuid', kind: 'preview'}),
          preview: {placeholderAccountUuid: 'placeholder-uuid'},
        },
      },
    })

    expect(getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)).toBeUndefined()
    expect(storage.get(storeAuthSessionKey('shop.myshopify.com'))).toBeUndefined()
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

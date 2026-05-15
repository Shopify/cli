import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {
  clearStoredStoreAppSession,
  getCurrentStoredStoreAppSession,
  isPreviewStoreSession,
  sessionKind,
  setStoredStoreAppSession,
  type StoredStoreAppSession,
  type StoredPreviewStoreMetadata,
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

function buildPreviewMetadata(
  overrides: Partial<StoredPreviewStoreMetadata> = {},
): StoredPreviewStoreMetadata {
  return {
    placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    coreUrl: 'https://app.shop.dev',
    ...overrides,
  }
}

function buildPreviewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'preview-1.myshopify.io',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: 'placeholder:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    accessToken: 'shpat_preview_token',
    scopes: ['read_products', 'write_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    kind: 'preview',
    preview: buildPreviewMetadata(),
    ...overrides,
  }
}

describe('preview-store discriminator', () => {
  test('sessionKind defaults to standard when the discriminator is omitted', () => {
    expect(sessionKind(buildSession())).toBe('standard')
  })

  test('sessionKind returns preview when the discriminator is set to preview', () => {
    expect(sessionKind(buildPreviewSession())).toBe('preview')
  })

  test('isPreviewStoreSession narrows preview-kind sessions with metadata', () => {
    const session = buildPreviewSession()
    expect(isPreviewStoreSession(session)).toBe(true)
    if (isPreviewStoreSession(session)) {
      // The narrowed type makes `preview` non-optional.
      expect(session.preview.placeholderAccountUuid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    }
  })

  test('isPreviewStoreSession returns false for standard sessions', () => {
    expect(isPreviewStoreSession(buildSession())).toBe(false)
  })

  test('round-trips a preview-kind session including its metadata', () => {
    const storage = inMemoryStorage()
    const session = buildPreviewSession({
      preview: buildPreviewMetadata({
        magicLinkUrl: 'https://preview-1.myshopify.io/magic/abc',
        magicLinkExpiresAt: '2026-03-27T00:30:00.000Z',
      }),
    })

    setStoredStoreAppSession(session, storage as any)

    expect(getCurrentStoredStoreAppSession('preview-1.myshopify.io', storage as any)).toEqual(session)
  })

  test('reads a legacy stored session (without kind) back as a standard session', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: {
        '42': buildSession(),
      },
    })

    const loaded = getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)!

    expect(loaded.kind).toBeUndefined()
    expect(sessionKind(loaded)).toBe('standard')
    expect(isPreviewStoreSession(loaded)).toBe(false)
  })

  test('omits the kind field on disk for standard sessions to keep legacy buckets quiet', () => {
    const storage = inMemoryStorage()
    setStoredStoreAppSession(buildSession(), storage as any)

    const stored = (storage.get(storeAuthSessionKey('shop.myshopify.com')) as any).sessionsByUserId['42']
    expect(stored).not.toHaveProperty('kind')
    expect(stored).not.toHaveProperty('preview')
  })

  test('coerces an unknown kind value to standard and drops it from the result', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('shop.myshopify.com'), {
      currentUserId: '42',
      sessionsByUserId: {
        '42': {...buildSession(), kind: 'something-new'},
      },
    })

    const loaded = getCurrentStoredStoreAppSession('shop.myshopify.com', storage as any)!
    expect(loaded.kind).toBeUndefined()
    expect(sessionKind(loaded)).toBe('standard')
  })

  test('rejects a preview-kind session that is missing required preview metadata', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('preview-1.myshopify.io'), {
      currentUserId: 'placeholder:abc',
      sessionsByUserId: {
        'placeholder:abc': {
          ...buildPreviewSession({userId: 'placeholder:abc'}),
          preview: undefined,
        },
      },
    })

    expect(getCurrentStoredStoreAppSession('preview-1.myshopify.io', storage as any)).toBeUndefined()
  })

  test('rejects a preview-kind session with malformed preview metadata', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('preview-1.myshopify.io'), {
      currentUserId: 'placeholder:abc',
      sessionsByUserId: {
        'placeholder:abc': {
          ...buildPreviewSession({userId: 'placeholder:abc'}),
          preview: {placeholderAccountUuid: 123, coreUrl: false},
        },
      },
    })

    expect(getCurrentStoredStoreAppSession('preview-1.myshopify.io', storage as any)).toBeUndefined()
  })

  test('drops malformed optional preview metadata fields without rejecting the session', () => {
    const storage = inMemoryStorage()
    storage.set(storeAuthSessionKey('preview-1.myshopify.io'), {
      currentUserId: 'placeholder:abc',
      sessionsByUserId: {
        'placeholder:abc': {
          ...buildPreviewSession({userId: 'placeholder:abc'}),
          preview: {
            placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            coreUrl: 'https://app.shop.dev',
            magicLinkUrl: 42,
            magicLinkExpiresAt: false,
          },
        },
      },
    })

    const loaded = getCurrentStoredStoreAppSession('preview-1.myshopify.io', storage as any)!
    expect(loaded.preview).toEqual({
      placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      coreUrl: 'https://app.shop.dev',
    })
  })

  test('keeps a standard and a preview session side-by-side under the same store', () => {
    const storage = inMemoryStorage()
    const standard = buildSession({userId: '42', accessToken: 'token-standard'})
    const preview = buildPreviewSession({
      store: standard.store,
      userId: 'placeholder:abc',
      accessToken: 'token-preview',
    })

    setStoredStoreAppSession(standard, storage as any)
    setStoredStoreAppSession(preview, storage as any)

    // The most recently written session becomes the current one.
    expect(getCurrentStoredStoreAppSession(standard.store, storage as any)).toEqual(preview)
  })
})

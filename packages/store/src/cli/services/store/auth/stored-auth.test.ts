import {STORE_AUTH_APP_CLIENT_ID, storeAuthSessionKey} from './config.js'
import {setStoredStoreAppSession, type StoredStoreAppSession} from './session-store.js'
import {listStoredStoreAuthSummaries} from './stored-auth.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {describe, expect, test} from 'vitest'

function buildSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'shop.myshopify.com',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token-1',
    refreshToken: 'refresh-token-1',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  }
}

describe('listStoredStoreAuthSummaries', () => {
  test('returns an empty array when no store auth is persisted', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})

      expect(listStoredStoreAuthSummaries(storage as any)).toEqual([])
    })
  })

  test('returns one summary per store sorted by newest auth using the current user session', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})

      setStoredStoreAppSession(
        buildSession({store: 'b-shop.myshopify.com', acquiredAt: '2026-03-27T00:00:00.000Z'}),
        storage as any,
      )
      setStoredStoreAppSession(
        buildSession({store: 'a-shop.myshopify.com', userId: '41', accessToken: 'token-41'}),
        storage as any,
      )
      setStoredStoreAppSession(
        buildSession({
          store: 'a-shop.myshopify.com',
          userId: '84',
          accessToken: 'token-84',
          acquiredAt: '2026-03-28T00:00:00.000Z',
        }),
        storage as any,
      )

      expect(listStoredStoreAuthSummaries(storage as any)).toEqual([
        {
          store: 'a-shop.myshopify.com',
          userId: '84',
          scopes: ['read_products'],
          acquiredAt: '2026-03-28T00:00:00.000Z',
        },
        {
          store: 'b-shop.myshopify.com',
          userId: '42',
          scopes: ['read_products'],
          acquiredAt: '2026-03-27T00:00:00.000Z',
        },
      ])
    })
  })

  test('projects associated user metadata without exposing tokens', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})

      setStoredStoreAppSession(
        buildSession({
          expiresAt: '2026-03-28T00:00:00.000Z',
          refreshTokenExpiresAt: '2026-04-28T00:00:00.000Z',
          associatedUser: {
            id: 42,
            email: 'merchant@example.com',
            firstName: 'Merchant',
            lastName: 'User',
            accountOwner: true,
          },
        }),
        storage as any,
      )

      const [summary] = listStoredStoreAuthSummaries(storage as any)

      expect(summary).toEqual({
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-03-27T00:00:00.000Z',
        expiresAt: '2026-03-28T00:00:00.000Z',
        refreshTokenExpiresAt: '2026-04-28T00:00:00.000Z',
        associatedUser: {
          id: 42,
          email: 'merchant@example.com',
          firstName: 'Merchant',
          lastName: 'User',
          accountOwner: true,
        },
      })
      expect(summary).not.toHaveProperty('accessToken')
      expect(summary).not.toHaveProperty('refreshToken')
    })
  })

  test('drops malformed sibling sessions while preserving the current session', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})
      const key = storeAuthSessionKey('shop.myshopify.com')
      storage.set(key, {
        currentUserId: '42',
        sessionsByUserId: {
          '41': {userId: '41'},
          '42': buildSession(),
        },
      })

      expect(listStoredStoreAuthSummaries(storage as any)).toEqual([
        {
          store: 'shop.myshopify.com',
          userId: '42',
          scopes: ['read_products'],
          acquiredAt: '2026-03-27T00:00:00.000Z',
        },
      ])
      expect(Object.keys((storage.get(key) as any).sessionsByUserId)).toEqual(['42'])
    })
  })

  test('skips malformed persisted buckets while listing summaries', async () => {
    await inTemporaryDirectory((cwd) => {
      const storage = new LocalStorage<Record<string, unknown>>({cwd})
      storage.set(storeAuthSessionKey('broken-shop.myshopify.com'), {
        currentUserId: '42',
        sessionsByUserId: {
          '42': {userId: '42'},
        },
      })

      expect(listStoredStoreAuthSummaries(storage as any)).toEqual([])
      expect(storage.get(storeAuthSessionKey('broken-shop.myshopify.com'))).toBeUndefined()
    })
  })
})

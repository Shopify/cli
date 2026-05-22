import {listStoredStores} from './index.js'
import * as bpSource from './bp-source.js'
import {STORE_AUTH_APP_CLIENT_ID} from '../auth/config.js'
import * as sessionStore from '../auth/session-store.js'
import {type StoredStoreAppSession} from '../auth/session-store.js'
import {describe, test, expect, vi, afterEach} from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
})

function buildStandardSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'b-shop.myshopify.com',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token-standard',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    associatedUser: {id: 42, email: 'merchant@example.com'},
    ...overrides,
  }
}

function buildPreviewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'a-preview.myshopify.io',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: 'placeholder:aaaa',
    accessToken: 'shpat_preview',
    scopes: ['read_products', 'write_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    kind: 'preview',
    preview: {
      placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      coreUrl: 'https://app.shop.dev',
    },
    ...overrides,
  }
}

function mockStoredSessions(sessions: StoredStoreAppSession[]): void {
  vi.spyOn(sessionStore, 'listStoredStoreAppSessions').mockReturnValue(sessions)
}

describe('listStoredStores', () => {
  describe('local source', () => {
    test('returns an empty array when no sessions are stored', async () => {
      mockStoredSessions([])
      const result = await listStoredStores({source: 'local'})
      expect(result).toEqual({entries: [], source: 'local'})
    })

    test('sorts entries alphabetically by store domain regardless of stored order', async () => {
      mockStoredSessions([buildStandardSession(), buildPreviewSession()])

      const result = await listStoredStores({source: 'local'})
      expect(result.entries.map((entry) => entry.store)).toEqual([
        'a-preview.myshopify.io',
        'b-shop.myshopify.com',
      ])
    })

    test('projects a standard session into a row with email when available', async () => {
      mockStoredSessions([buildStandardSession()])

      const result = await listStoredStores({source: 'local'})
      expect(result.entries).toEqual([
        {
          store: 'b-shop.myshopify.com',
          kind: 'standard',
          userId: '42',
          email: 'merchant@example.com',
        },
      ])
    })

    test('omits email when the standard session has no associated user', async () => {
      mockStoredSessions([buildStandardSession({associatedUser: undefined})])
      const result = await listStoredStores({source: 'local'})
      expect(result.entries[0]).not.toHaveProperty('email')
    })

    test('surfaces preview metadata on preview rows', async () => {
      mockStoredSessions([buildPreviewSession()])

      const result = await listStoredStores({source: 'local'})
      expect(result.entries).toEqual([
        {
          store: 'a-preview.myshopify.io',
          kind: 'preview',
          userId: 'placeholder:aaaa',
          placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          coreUrl: 'https://app.shop.dev',
        },
      ])
    })

    test('filters by kind when requested', async () => {
      mockStoredSessions([buildStandardSession(), buildPreviewSession()])

      const previewResult = await listStoredStores({source: 'local', kind: 'preview'})
      expect(previewResult.entries.map((entry) => entry.store)).toEqual(['a-preview.myshopify.io'])

      const standardResult = await listStoredStores({source: 'local', kind: 'standard'})
      expect(standardResult.entries.map((entry) => entry.store)).toEqual(['b-shop.myshopify.com'])
    })
  })

  describe('bp source (default)', () => {
    test('forwards search to the BP-source helper and returns its entries verbatim', async () => {
      const spy = vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
        entries: [
          {
            store: 'foo.myshopify.com',
            kind: 'standard',
            userId: '42',
            organizationId: '1',
            organizationName: 'Acme',
            storeType: 'PRODUCTION',
            displayName: 'Acme Store',
          },
        ],
        currentUserEmail: 'user@example.com',
        unresolvedCurrentUser: false,
        organizationCount: 1,
      })

      const result = await listStoredStores({search: 'foo'})

      expect(spy).toHaveBeenCalledWith({search: 'foo'})
      expect(result.source).toBe('bp')
      expect(result.entries).toHaveLength(1)
      expect(result.currentUserEmail).toBe('user@example.com')
      expect(result.notice).toBeUndefined()
    })

    test('surfaces a placeholder-friendly notice when BP can\u2019t resolve currentUserAccount', async () => {
      vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
        entries: [],
        unresolvedCurrentUser: true,
        organizationCount: 0,
      })

      const result = await listStoredStores()

      expect(result.entries).toEqual([])
      expect(result.notice).toMatch(/Business Platform could not resolve/i)
      expect(result.notice).toMatch(/--source local/)
    })

    test('surfaces a no-orgs notice when the user is real but has 0 orgs with CLI access', async () => {
      vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
        entries: [],
        currentUserEmail: 'realuser@example.com',
        unresolvedCurrentUser: false,
        organizationCount: 0,
      })

      const result = await listStoredStores()
      expect(result.notice).toMatch(/No organizations with CLI access/i)
    })

    test('surfaces an empty-orgs notice when the user has orgs but no shops', async () => {
      vi.spyOn(bpSource, 'listBusinessPlatformStores').mockResolvedValue({
        entries: [],
        currentUserEmail: 'realuser@example.com',
        unresolvedCurrentUser: false,
        organizationCount: 3,
      })

      const result = await listStoredStores()
      expect(result.notice).toMatch(/No shops accessible.*3 organization/i)
    })
  })
})

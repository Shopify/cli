import {listStoredStores} from './index.js'
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
  test('returns an empty array when no sessions are stored', () => {
    mockStoredSessions([])
    expect(listStoredStores()).toEqual([])
  })

  test('sorts entries alphabetically by store domain regardless of stored order', () => {
    mockStoredSessions([buildStandardSession(), buildPreviewSession()])

    const result = listStoredStores()
    expect(result.map((entry) => entry.store)).toEqual([
      'a-preview.myshopify.io',
      'b-shop.myshopify.com',
    ])
  })

  test('projects a standard session into a row with email when available', () => {
    mockStoredSessions([buildStandardSession()])

    expect(listStoredStores()).toEqual([
      {
        store: 'b-shop.myshopify.com',
        kind: 'standard',
        userId: '42',
        email: 'merchant@example.com',
      },
    ])
  })

  test('omits email when the standard session has no associated user', () => {
    mockStoredSessions([buildStandardSession({associatedUser: undefined})])
    const [entry] = listStoredStores()
    expect(entry).not.toHaveProperty('email')
  })

  test('surfaces preview metadata on preview rows', () => {
    mockStoredSessions([buildPreviewSession()])

    expect(listStoredStores()).toEqual([
      {
        store: 'a-preview.myshopify.io',
        kind: 'preview',
        userId: 'placeholder:aaaa',
        placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        coreUrl: 'https://app.shop.dev',
      },
    ])
  })

  test('filters by kind when requested', () => {
    mockStoredSessions([buildStandardSession(), buildPreviewSession()])

    expect(listStoredStores({kind: 'preview'}).map((entry) => entry.store)).toEqual([
      'a-preview.myshopify.io',
    ])
    expect(listStoredStores({kind: 'standard'}).map((entry) => entry.store)).toEqual([
      'b-shop.myshopify.com',
    ])
  })
})


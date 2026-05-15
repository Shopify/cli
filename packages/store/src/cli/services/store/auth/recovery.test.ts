import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {
  throwReauthenticateForSession,
  throwReauthenticatePreviewStoreError,
  throwReauthenticateStoreAuthError,
  throwStoredStoreAuthError,
} from './recovery.js'
import {type StoredStoreAppSession} from './session-store.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

function buildStandardSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'shop.myshopify.com',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    scopes: ['read_products', 'write_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  }
}

function buildPreviewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: 'preview-1.myshopify.io',
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: 'placeholder:abc',
    accessToken: 'shpat_preview_token',
    scopes: ['read_products'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    kind: 'preview',
    preview: {
      placeholderAccountUuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      coreUrl: 'https://app.shop.dev',
    },
    ...overrides,
  }
}

describe('throwStoredStoreAuthError', () => {
  test('points the user at `shopify store auth` with a placeholder for scopes', () => {
    expect(() => throwStoredStoreAuthError('shop.myshopify.com')).toThrow(AbortError)

    try {
      throwStoredStoreAuthError('shop.myshopify.com')
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.message).toBe('No stored app authentication found for shop.myshopify.com.')
      expect(thrown.tryMessage).toBe('To create stored auth for this store, run:')
    }
  })
})

describe('throwReauthenticateStoreAuthError', () => {
  test('preserves the caller message and surfaces the `shopify store auth` next-step', () => {
    try {
      throwReauthenticateStoreAuthError('boom', 'shop.myshopify.com', 'read_products,write_products')
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.message).toBe('boom')
      expect(thrown.tryMessage).toBe('To re-authenticate, run:')
    }
  })
})

describe('throwReauthenticatePreviewStoreError', () => {
  test('does not suggest the standard `shopify store auth` PKCE flow', () => {
    try {
      throwReauthenticatePreviewStoreError('boom', 'preview-1.myshopify.io')
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.message).toBe('boom')
      expect(thrown.tryMessage).toContain("Preview store sessions can't be refreshed")
      expect(JSON.stringify(thrown)).not.toContain('shopify store auth')
    }
  })
})

describe('throwReauthenticateForSession', () => {
  test('routes a standard session to the PKCE re-auth helper', () => {
    try {
      throwReauthenticateForSession('boom', buildStandardSession())
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.tryMessage).toBe('To re-authenticate, run:')
      expect(JSON.stringify(thrown)).toContain('shopify store auth --store shop.myshopify.com')
    }
  })

  test('routes a preview-kind session to the preview-specific recovery helper', () => {
    try {
      throwReauthenticateForSession('boom', buildPreviewSession())
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.tryMessage).toContain("Preview store sessions can't be refreshed")
      expect(JSON.stringify(thrown)).not.toContain('shopify store auth')
    }
  })

  test('falls back to the standard helper when the kind is preview but metadata is missing', () => {
    // Defensive case: a session marked `kind: 'preview'` without `preview` metadata could
    // not be re-minted anyway, but `isPreviewStoreSession` requires both. We treat it as
    // a malformed standard session and surface the existing helper rather than crashing.
    const malformed = {...buildPreviewSession(), preview: undefined}

    try {
      throwReauthenticateForSession('boom', malformed)
    } catch (error) {
      const thrown = error as AbortError
      expect(thrown.tryMessage).toBe('To re-authenticate, run:')
    }
  })
})

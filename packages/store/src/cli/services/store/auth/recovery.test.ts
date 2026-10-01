import {
  throwStoredStoreAuthError,
  throwReauthenticateStoreAuthError,
  throwStoredAuthInvalidError,
  retryStoreAuthWithPermanentDomainError,
} from './recovery.js'
import {STORE_AUTH_APP_CLIENT_ID} from './config.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'
import type {StoredStoreAppSession} from '@shopify/cli-kit/node/store-auth-session'

const SHOP = 'shop.myshopify.com'

function standardSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    store: SHOP,
    clientId: STORE_AUTH_APP_CLIENT_ID,
    userId: '42',
    accessToken: 'token',
    scopes: ['read_products', 'write_orders'],
    acquiredAt: '2026-03-27T00:00:00.000Z',
    ...overrides,
  }
}

function previewSession(overrides: Partial<StoredStoreAppSession> = {}): StoredStoreAppSession {
  return {
    ...standardSession({
      userId: 'preview:placeholder-uuid',
      // The full preapproved catalog is much larger in practice; a couple of entries are enough
      // to prove the placeholder is used instead of these.
      scopes: ['read_products', 'write_products', 'read_themes'],
    }),
    kind: 'preview',
    preview: {
      shopId: '123',
      name: 'Lavender Candles',
      createdAt: '2026-03-27T00:00:00.000Z',
    },
    ...overrides,
  }
}

describe('throwStoredStoreAuthError', () => {
  test('reports no stored auth and prompts to authenticate (not re-authenticate) with a scopes placeholder', () => {
    let captured: AbortError | undefined
    try {
      throwStoredStoreAuthError(SHOP)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      captured = error as AbortError
    }

    expect(captured).toMatchObject({
      message: `No stored app authentication found for ${SHOP}.`,
      nextSteps: [
        ['Run', {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`}, 'to authenticate'],
      ],
    })
  })
})

describe('throwReauthenticateStoreAuthError', () => {
  test('suggests the real scopes for a standard session', () => {
    let captured: AbortError | undefined
    try {
      throwReauthenticateStoreAuthError('Custom message.', standardSession())
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      captured = error as AbortError
    }

    expect(captured).toMatchObject({
      message: 'Custom message.',
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes read_products,write_orders`},
          'to re-authenticate',
        ],
      ],
    })
  })

  test('suggests a scopes placeholder for a preview session instead of its preapproved catalog', () => {
    let captured: AbortError | undefined
    try {
      throwReauthenticateStoreAuthError('Custom message.', previewSession())
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      captured = error as AbortError
    }

    expect(captured).toMatchObject({
      message: 'Custom message.',
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`},
          'to re-authenticate',
        ],
      ],
    })
  })
})

describe('throwStoredAuthInvalidError', () => {
  test('uses the generic invalid-auth message and real scopes for a standard session', () => {
    let captured: AbortError | undefined
    try {
      throwStoredAuthInvalidError(standardSession())
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      captured = error as AbortError
    }

    expect(captured).toMatchObject({
      message: `Stored app authentication for ${SHOP} is no longer valid.`,
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes read_products,write_orders`},
          'to re-authenticate',
        ],
      ],
    })
  })

  test('flags a likely claim and suggests a scopes placeholder for a preview session', () => {
    let captured: AbortError | undefined
    try {
      throwStoredAuthInvalidError(previewSession())
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      captured = error as AbortError
    }

    expect(captured).toMatchObject({
      message: `The preview store ${SHOP} has likely been claimed, so its stored authentication is no longer valid.`,
      nextSteps: [
        [
          'Run',
          {command: `shopify store auth --store ${SHOP} --scopes <comma-separated-scopes>`},
          'to re-authenticate',
        ],
      ],
    })
  })
})

describe('retryStoreAuthWithPermanentDomainError', () => {
  test('returns (rather than throws) an AbortError pointing at the permanent domain with a scopes placeholder', () => {
    const error = retryStoreAuthWithPermanentDomainError('permanent-shop.myshopify.com')

    expect(error).toBeInstanceOf(AbortError)
    expect(error).toMatchObject({
      message: 'OAuth callback store does not match the requested store.',
      tryMessage:
        'Shopify returned permanent-shop.myshopify.com during authentication. Re-run using the permanent store domain:',
      nextSteps: [
        [{command: 'shopify store auth --store permanent-shop.myshopify.com --scopes <comma-separated-scopes>'}],
      ],
    })
  })
})

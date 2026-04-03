import {beforeEach, describe, expect, test, vi} from 'vitest'
import {getStoreAuthInfo, displayStoreAuthInfo, showStoreAuthInfo} from './auth-info.js'
import {createStoredStoreAuthError} from './auth-recovery.js'
import {getStoredStoreAppSession, isSessionExpired} from './session.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('./session.js')
vi.mock('./auth-recovery.js', () => ({
  createStoredStoreAuthError: vi.fn((store: string) => new Error(`No stored app authentication found for ${store}.`)),
}))
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('store auth info service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns stored auth info for a store', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'token',
      refreshToken: 'refresh-token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      expiresAt: '2026-04-02T01:00:00.000Z',
      refreshTokenExpiresAt: '2026-04-03T00:00:00.000Z',
      associatedUser: {id: 42, email: 'test@example.com'},
    } as any)
    vi.mocked(isSessionExpired).mockReturnValue(false)

    expect(getStoreAuthInfo('shop.myshopify.com')).toEqual({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      expiresAt: '2026-04-02T01:00:00.000Z',
      refreshTokenExpiresAt: '2026-04-03T00:00:00.000Z',
      hasRefreshToken: true,
      isExpired: false,
      associatedUser: {id: 42, email: 'test@example.com'},
    })
  })

  test('throws the stored auth recovery error when no stored auth exists for the store', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue(undefined)

    expect(() => getStoreAuthInfo('shop.myshopify.com')).toThrow('No stored app authentication found for shop.myshopify.com.')
    expect(createStoredStoreAuthError).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('normalizes the store before loading stored auth info', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)
    vi.mocked(isSessionExpired).mockReturnValue(false)

    expect(getStoreAuthInfo('https://shop.myshopify.com/admin')).toEqual({
      store: 'shop.myshopify.com',
      userId: '42',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
      hasRefreshToken: false,
      isExpired: false,
    })
    expect(getStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
  })

  test('renders text output', () => {
    displayStoreAuthInfo(
      {
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products', 'write_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
        expiresAt: '2026-04-02T01:00:00.000Z',
        refreshTokenExpiresAt: '2026-04-03T00:00:00.000Z',
        hasRefreshToken: true,
        isExpired: false,
        associatedUser: {id: 42, email: 'test@example.com'},
      },
      'text',
    )

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Stored auth for shop.myshopify.com',
      customSections: [
        {
          body: {
            tabularData: [
              ['User', 'test@example.com (42)'],
              ['Scopes', 'read_products,write_products'],
              ['Stored at', '2026-04-02T00:00:00.000Z'],
              ['Expires at', '2026-04-02T01:00:00.000Z'],
              ['Refresh token', 'stored'],
              ['Refresh token expires at', '2026-04-03T00:00:00.000Z'],
              ['Status', 'valid'],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  })

  test('renders text output for sparse session details', () => {
    displayStoreAuthInfo(
      {
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
        hasRefreshToken: false,
        isExpired: true,
      },
      'text',
    )

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Stored auth for shop.myshopify.com',
      customSections: [
        {
          body: {
            tabularData: [
              ['User', '42'],
              ['Scopes', 'read_products'],
              ['Stored at', '2026-04-02T00:00:00.000Z'],
              ['Expires at', 'unknown'],
              ['Refresh token', 'missing'],
              ['Refresh token expires at', 'not applicable'],
              ['Status', 'expired'],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  })

  test('renders when Shopify does not provide refresh token expiry', () => {
    displayStoreAuthInfo(
      {
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
        hasRefreshToken: true,
        isExpired: false,
      },
      'text',
    )

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Stored auth for shop.myshopify.com',
      customSections: [
        {
          body: {
            tabularData: [
              ['User', '42'],
              ['Scopes', 'read_products'],
              ['Stored at', '2026-04-02T00:00:00.000Z'],
              ['Expires at', 'unknown'],
              ['Refresh token', 'stored'],
              ['Refresh token expires at', 'not provided by Shopify'],
              ['Status', 'valid'],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  })

  test('renders json output', () => {
    displayStoreAuthInfo(
      {
        store: 'shop.myshopify.com',
        userId: '42',
        scopes: ['read_products'],
        acquiredAt: '2026-04-02T00:00:00.000Z',
        hasRefreshToken: false,
        isExpired: true,
      },
      'json',
    )

    expect(outputResult).toHaveBeenCalledWith(`{
  "store": "shop.myshopify.com",
  "userId": "42",
  "scopes": [
    "read_products"
  ],
  "acquiredAt": "2026-04-02T00:00:00.000Z",
  "hasRefreshToken": false,
  "isExpired": true
}`)
  })

  test('loads and displays stored auth info for the requested store', () => {
    vi.mocked(getStoredStoreAppSession).mockReturnValue({
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: '42',
      accessToken: 'token',
      scopes: ['read_products'],
      acquiredAt: '2026-04-02T00:00:00.000Z',
    } as any)
    vi.mocked(isSessionExpired).mockReturnValue(false)

    showStoreAuthInfo('shop.myshopify.com')

    expect(getStoredStoreAppSession).toHaveBeenCalledWith('shop.myshopify.com')
    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Stored auth for shop.myshopify.com',
      customSections: [
        {
          body: {
            tabularData: [
              ['User', '42'],
              ['Scopes', 'read_products'],
              ['Stored at', '2026-04-02T00:00:00.000Z'],
              ['Expires at', 'unknown'],
              ['Refresh token', 'missing'],
              ['Refresh token expires at', 'not applicable'],
              ['Status', 'valid'],
            ],
            firstColumnSubdued: true,
          },
        },
      ],
    })
  })
})

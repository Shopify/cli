import {describe, test, expect, vi, beforeEach} from 'vitest'
import {
  authenticateStoreWithApp,
  buildStoreAuthUrl,
  parseStoreAuthScopes,
  verifyStoreAuthHmac,
  exchangeStoreAuthCodeForToken,
} from './auth.js'
import {setStoredStoreAppSession} from './session.js'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'

vi.mock('./session.js')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/http')
vi.mock('@shopify/cli-kit/node/system', () => ({openURL: vi.fn().mockResolvedValue(true)}))
vi.mock('@shopify/cli-kit/node/crypto', () => ({randomUUID: vi.fn().mockReturnValue('state-123')}))

describe('store auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileExists).mockResolvedValue(true)
    vi.mocked(readFile).mockResolvedValue('secret-value' as any)
  })

  test('parseStoreAuthScopes splits and deduplicates scopes', () => {
    expect(parseStoreAuthScopes('read_products, write_products,read_products')).toEqual([
      'read_products',
      'write_products',
    ])
  })

  test('buildStoreAuthUrl includes per-user grant options', () => {
    const url = new URL(
      buildStoreAuthUrl({
        store: 'shop.myshopify.com',
        scopes: ['read_products', 'write_products'],
        state: 'state-123',
        redirectUri: 'http://localhost:3458/auth/callback',
      }),
    )

    expect(url.hostname).toBe('shop.myshopify.com')
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('4c6af92692662b9c95c8a47b1520aced')
    expect(url.searchParams.get('scope')).toBe('read_products,write_products')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3458/auth/callback')
    expect(url.searchParams.getAll('grant_options[]')).toEqual(['per-user'])
  })

  test('verifyStoreAuthHmac validates Shopify callback signatures', async () => {
    const params = new URLSearchParams([
      ['code', 'abc123'],
      ['shop', 'shop.myshopify.com'],
      ['state', 'state-123'],
      ['timestamp', '1711550000'],
    ])

    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    const crypto = await import('crypto')
    const hmac = crypto.createHmac('sha256', 'secret-value').update(message).digest('hex')
    params.set('hmac', hmac)

    expect(verifyStoreAuthHmac(params, 'secret-value')).toBe(true)
    expect(verifyStoreAuthHmac(params, 'wrong-secret')).toBe(false)
  })

  test('exchangeStoreAuthCodeForToken returns token response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('{"access_token":"token","scope":"read_products","associated_user_scope":"read_products"}'),
    } as any)

    const response = await exchangeStoreAuthCodeForToken({
      store: 'shop.myshopify.com',
      code: 'abc123',
      clientSecret: 'secret-value',
    })

    expect(response).toEqual({
      access_token: 'token',
      scope: 'read_products',
      associated_user_scope: 'read_products',
    })
  })

  test('authenticateStoreWithApp stores the app session', async () => {
    await authenticateStoreWithApp(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
        clientSecretFile: '/tmp/client-secret.txt',
        port: 3458,
      },
      {
        openURL: vi.fn().mockResolvedValue(true),
        waitForStoreAuthCode: vi.fn().mockResolvedValue('abc123'),
        exchangeStoreAuthCodeForToken: vi.fn().mockResolvedValue({
          access_token: 'token',
          associated_user_scope: 'read_products',
        }),
        renderInfo: vi.fn(),
        renderSuccess: vi.fn(),
      },
    )

    expect(setStoredStoreAppSession).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      clientId: '4c6af92692662b9c95c8a47b1520aced',
      accessToken: 'token',
      scopes: ['read_products', 'write_products'],
      associatedUserScope: 'read_products',
      acquiredAt: expect.any(String),
    })
  })
})

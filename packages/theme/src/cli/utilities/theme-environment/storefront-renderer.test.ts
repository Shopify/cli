import {render} from './storefront-renderer.js'
import {getStorefrontSessionCookies} from './storefront-session.js'
import {DevServerRenderContext} from './types.js'
import {describe, expect, test, vi} from 'vitest'
import {fetch} from '@shopify/cli-kit/node/http'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'

vi.mock('./storefront-session.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/http', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/http')
  return {
    ...actual,
    fetch: vi.fn(),
  }
})

const successResponse = {ok: true, status: 200, headers: {get: vi.fn()}} as any
const sessionCookies = {
  storefront_digest: '00001111222233334444',
  _shopify_essential: ':00112233445566778899:',
}

const session = {
  token: 'token_abc123',
  storeFqdn: 'store.myshopify.com',
  storefrontToken: 'token',
  storefrontPassword: 'password',
  expiresAt: new Date(),
}

const context: DevServerRenderContext = {
  method: 'GET',
  path: '/products/1',
  themeId: '123',
  query: [],
  headers: {
    'Content-Length': '100',
    'X-Special-Header': '200',
    cookie: 'theme_cookie=abc;',
    Cookie: 'theme_cookie=def;',
  },
  replaceTemplates: {},
  sectionId: '',
}

describe('render', () => {
  test('renders using storefront API', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(successResponse)
    vi.mocked(getStorefrontSessionCookies).mockResolvedValue(sessionCookies)
    vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('token_111222333')

    // When
    const response = await render(session, context)

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_111222333',
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'Content-Length': '100',
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using theme access API', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(successResponse)
    vi.mocked(getStorefrontSessionCookies).mockResolvedValue(sessionCookies)
    const themeKitAccessSession = {...session, token: 'shptka_abc123'}

    // When
    const response = await render(themeKitAccessSession, context)

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://theme-kit-access.shopifyapps.com/cli/sfr/products/1?_fd=0&pb=0',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'X-Shopify-Shop': 'store.myshopify.com',
          'X-Shopify-Access-Token': 'shptka_abc123',
          'Content-Length': '100',
        }),
      }),
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://theme-kit-access.shopifyapps.com/cli/sfr/products/1?_fd=0&pb=0',
      expect.objectContaining({
        method: 'POST',
        headers: expect.not.objectContaining({
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using section ID', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(successResponse)
    vi.mocked(getStorefrontSessionCookies).mockResolvedValue(sessionCookies)
    vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('token_111222333')

    // When
    const response = await render(session, {
      ...context,
      sectionId: 'sections--1__announcement-bar',
    })

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0&section_id=sections--1__announcement-bar',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_111222333',
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'Content-Length': '100',
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using query parameters', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(successResponse)
    vi.mocked(getStorefrontSessionCookies).mockResolvedValue(sessionCookies)
    vi.mocked(ensureAuthenticatedStorefront).mockResolvedValue('token_111222333')

    // When
    const response = await render(session, {
      ...context,
      query: [
        ['value', 'A'],
        ['value', 'B'],
      ],
    })

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0&value=A&value=B',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_111222333',
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'Content-Length': '100',
          'X-Special-Header': '200',
        }),
      }),
    )
  })
})

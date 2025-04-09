import {render} from './storefront-renderer.js'
import {DevServerRenderContext, DevServerSession} from './types.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.stubGlobal('fetch', vi.fn())

const session: DevServerSession = {
  token: 'admin_token_abc123',
  storeFqdn: 'store.myshopify.com',
  storefrontToken: 'token_111222333',
  storefrontPassword: 'password',
  sessionCookies: {
    storefront_digest: '00001111222233334444',
    _shopify_essential: ':00112233445566778899:',
  },
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
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {headers: {'Content-Type': 'application/json', something: 'else'}}),
    )

    // When
    const response = await render(session, context)

    // Then
    expect(response.status).toEqual(200)
    expect(response.headers.get('Content-Type')).toBeNull()
    expect(response.headers.get('something')).toEqual('else')
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0',
      expect.objectContaining({
        method: 'GET',
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
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {headers: {'Content-Type': 'application/json', something: 'else'}}),
    )
    const themeKitAccessSession = {...session, token: 'shptka_abc123'}

    // When
    const response = await render(themeKitAccessSession, context)

    // Then
    expect(response.status).toEqual(200)
    expect(response.headers.get('Content-Type')).toBeNull()
    expect(response.headers.get('something')).toEqual('else')
    expect(fetch).toHaveBeenCalledWith(
      'https://theme-kit-access.shopifyapps.com/cli/sfr/products/1?_fd=0&pb=0',
      expect.objectContaining({
        method: 'GET',
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
        method: 'GET',
        headers: expect.not.objectContaining({
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using the section_id', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(new Response())

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
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_111222333',
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'Content-Length': '100',
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using the app_block_id', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(new Response())

    // When
    const response = await render(session, {
      ...context,
      appBlockId: '00001111222233334444',
    })

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0&app_block_id=00001111222233334444',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_111222333',
          Cookie: 'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
          'Content-Length': '100',
          'X-Special-Header': '200',
        }),
      }),
    )
  })

  test('renders using the section_id when section_id and app_block_id are provided', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(new Response())

    // When
    const response = await render(session, {
      ...context,
      sectionId: 'sections--1__announcement-bar',
      appBlockId: '00001111222233334444',
    })

    // Then
    expect(response.status).toEqual(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0&section_id=sections--1__announcement-bar',
      expect.objectContaining({
        method: 'GET',
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
    vi.mocked(fetch).mockResolvedValue(new Response())

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
        method: 'GET',
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

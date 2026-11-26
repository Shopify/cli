import {render} from './storefront-renderer.js'
import {DevServerRenderContext, DevServerSession} from './types.js'
import {describe, expect, test, vi} from 'vitest'
import {fetch as cliKitFetch, Response as NodeFetchResponse} from '@shopify/cli-kit/node/http'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/http')>()),
  fetch: vi.fn(),
}))
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
    expect(response.headers.get('Content-Type')).toEqual('application/json')
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

  test('passes crawler signature headers to SFR requests', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, {headers: {'Content-Type': 'application/json'}}))

    await render(
      {
        ...session,
        crawlerSignatureHeaders: {
          Signature: 'signature-value',
          'Signature-Input': 'signature-input-value',
          'Signature-Agent': 'signature-agent-value',
        },
      },
      context,
    )

    expect(fetch).toHaveBeenCalledWith(
      'https://store.myshopify.com/products/1?_fd=0&pb=0',
      expect.objectContaining({
        headers: expect.objectContaining({
          Signature: 'signature-value',
          'Signature-Input': 'signature-input-value',
          'Signature-Agent': 'signature-agent-value',
        }),
      }),
    )
  })

  test('preserves Content-Type header for JSON responses', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"test": "data"}', {headers: {'Content-Type': 'application/json', something: 'else'}}),
    )

    // When
    const response = await render(session, context)

    // Then
    expect(response.status).toEqual(200)
    expect(response.headers.get('Content-Type')).toEqual('application/json')
    expect(response.headers.get('something')).toEqual('else')
  })

  test('removes Content-Type header for non-JSON responses', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html></html>', {headers: {'Content-Type': 'text/html', something: 'else'}}),
    )

    // When
    const response = await render(session, context)

    // Then
    expect(response.status).toEqual(200)
    expect(response.headers.get('Content-Type')).toBeNull()
    expect(response.headers.get('something')).toEqual('else')
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
    expect(response.headers.get('Content-Type')).toEqual('application/json')
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

  test('does not auto-follow 3xx responses on GET (preserves intermediate Set-Cookie)', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(
      new Response('redirected-body-should-not-be-returned', {
        status: 302,
        headers: {Location: 'https://store.myshopify.com/products/1'},
      }),
    )

    // When
    const response = await render(session, context)

    // Then
    expect(response.status).toEqual(302)
    expect(response.headers.get('Location')).toEqual('https://store.myshopify.com/products/1')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    )
  })

  test('does not auto-follow 3xx responses on POST (replaceTemplates branch)', async () => {
    // Given
    vi.mocked(fetch).mockResolvedValue(
      new Response('redirected-body-should-not-be-returned', {
        status: 302,
        headers: {Location: 'https://store.myshopify.com/products/1'},
      }),
    )

    // When
    const response = await render(session, {
      ...context,
      method: 'POST',
      replaceTemplates: {'sections/header.liquid': '<div>hello</div>'},
    })

    // Then
    expect(response.status).toEqual(302)
    expect(response.headers.get('Location')).toEqual('https://store.myshopify.com/products/1')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
      }),
    )
  })

  describe('exit page', () => {
    const exitPageContext: DevServerRenderContext = {
      ...context,
      path: '/url',
      query: [
        ['q', 'https://example.com/'],
        ['trigger', 'click'],
      ],
      headers: {
        ...context.headers,
        accept: 'text/html',
        referer: 'http://127.0.0.1:9292/products/1',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
      },
    }

    test('renders with the CLI fetch so the request keeps its navigation fetch metadata', async () => {
      // Given
      vi.mocked(cliKitFetch).mockResolvedValue(
        new NodeFetchResponse(null, {
          status: 302,
          headers: [
            ['Location', 'https://example.com/'],
            ['Set-Cookie', 'a=1; Path=/'],
            ['Set-Cookie', 'b=2; Path=/'],
          ],
        }),
      )

      // When
      const response = await render(session, exitPageContext)

      // Then
      expect(fetch).not.toHaveBeenCalled()
      expect(cliKitFetch).toHaveBeenCalledWith(
        'https://store.myshopify.com/url?_fd=0&pb=0&q=https%3A%2F%2Fexample.com%2F&trigger=click',
        {
          method: 'GET',
          redirect: 'manual',
          headers: expect.objectContaining({
            Authorization: 'Bearer token_111222333',
            Cookie:
              'theme_cookie=abc; storefront_digest=00001111222233334444; _shopify_essential=:00112233445566778899:',
            referer: 'http://127.0.0.1:9292/products/1',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'same-origin',
          }),
        },
        'slow-request',
      )
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toEqual(302)
      expect(response.headers.get('Location')).toEqual('https://example.com/')
      expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/'])
    })

    test('returns the page body as a web Response', async () => {
      // Given
      vi.mocked(cliKitFetch).mockResolvedValue(
        new NodeFetchResponse('<html>Leave the store?</html>', {
          status: 200,
          headers: {'Content-Type': 'text/html; charset=utf-8', 'x-request-id': 'abc'},
        }),
      )

      // When
      const response = await render(session, exitPageContext)

      // Then
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toEqual(200)
      expect(response.headers.get('x-request-id')).toEqual('abc')
      expect(response.headers.get('Content-Type')).toBeNull()
      await expect(response.text()).resolves.toEqual('<html>Leave the store?</html>')
    })

    test('renders a localized exit page with a GET, even with in-memory templates', async () => {
      // Given
      vi.mocked(cliKitFetch).mockResolvedValue(new NodeFetchResponse(null, {status: 200}))

      // When
      await render(session, {
        ...exitPageContext,
        path: '/fr-ca/url',
        replaceTemplates: {'sections/header.liquid': '<div>hello</div>'},
        replaceExtensionTemplates: {'blocks/block.liquid': '<div>hello</div>'},
      })

      // Then
      expect(fetch).not.toHaveBeenCalled()
      expect(cliKitFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/store\.myshopify\.com\/fr-ca\/url\?/),
        expect.objectContaining({method: 'GET', redirect: 'manual'}),
        'slow-request',
      )
      expect(vi.mocked(cliKitFetch).mock.calls[0]?.[1]).not.toHaveProperty('body')
    })

    test('throws a fetch error when the request fails', async () => {
      // Given
      vi.mocked(cliKitFetch).mockRejectedValue(new Error('socket hang up'))

      // When/Then
      await expect(render(session, exitPageContext)).rejects.toMatchObject({
        statusCode: 502,
        cause: expect.objectContaining({message: 'socket hang up'}),
        data: {url: expect.stringMatching(/^https:\/\/store\.myshopify\.com\/url\?/)},
      })
    })

    test.each<[DevServerRenderContext['method'], string]>([
      ['GET', '/pages/url'],
      ['GET', '/url-shortener'],
      ['GET', '/products/url'],
      ['POST', '/url'],
    ])('renders %s %s with the global fetch', async (method, path) => {
      // Given
      vi.mocked(fetch).mockResolvedValue(new Response())

      // When
      await render(session, {...exitPageContext, method, path})

      // Then
      expect(cliKitFetch).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledOnce()
    })
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

import {canProxyRequest, getProxyStorefrontHeaders, injectCdnProxy, patchRenderingResponse} from './proxy.js'
import {describe, test, expect} from 'vitest'
import {createEvent} from 'h3'
import {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'
import type {DevServerContext} from './types.js'

function createH3Event(method = 'GET', path = '/', headers = {}) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)

  req.method = method
  req.url = path
  req.headers = headers

  return createEvent(req, res)
}

describe('dev proxy', () => {
  const html = String.raw

  const ctx = {
    session: {storeFqdn: 'my-store.myshopify.com', sessionCookies: {}},
    options: {host: 'localhost', port: '1337'},
    localThemeFileSystem: {files: new Map([['assets/file1', 'content']])},
    localThemeExtensionFileSystem: {files: new Map([['assets/file-ext', 'content']])},
  } as unknown as DevServerContext

  describe('injectCdnProxy', () => {
    test('proxies Vanity CDN to through local server', () => {
      const content = html`<html>
        <head>
          <script src="https://my-store.myshopify.com/cdn/path/to/assets/file1"></script>
          <link href="https://my-store.myshopify.com/cdn/path/to/assets/file2"></link>
        </head>
        <body></body>
      </html>`

      expect(injectCdnProxy(content, ctx)).toMatchInlineSnapshot(`
        "<html>
                <head>
                  <script src=\\"/cdn/path/to/assets/file1\\"></script>
                  <link href=\\"/cdn/path/to/assets/file2\\"></link>
                </head>
                <body></body>
              </html>"
      `)
    })

    test('proxies requests to main global CDN for known local assets through local server', () => {
      const content = html`<html>
          <head>
            <script src="https://cdn.shopify.com/path/to/assets/file1"></script>
            <link href="https://cdn.shopify.com/path/to/assets/file1?v=123"></link>
            <link href="https://cdn.shopify.com/path/to/assets/file2"></link>
          </head>
          <body></body>
        </html>`

      expect(injectCdnProxy(content, ctx)).toMatchInlineSnapshot(`
        "<html>
                  <head>
                    <script src=\\"/cdn/path/to/assets/file1\\"></script>
                    <link href=\\"/cdn/path/to/assets/file1?v=123\\"></link>
                    <link href=\\"https://cdn.shopify.com/path/to/assets/file2\\"></link>
                  </head>
                  <body></body>
                </html>"
      `)
    })

    test('proxies requests to main global CDN for known local theme extension assets through local server', () => {
      const content = html`<html>
          <head>
            <script src="https://cdn.shopify.com/extensions/1aaaa11a-2b22-333c-4444-ee55555e55ee/0.0.0/assets/file-ext"></script>
            <link href="https://cdn.shopify.com/extensions/1aaaa11a-2b22-333c-0000-ee55555e55ee/0.1.0/assets/file-ext?v=123"></link>
            <link href="https://cdn.shopify.com/extensions/1aaaa11a-2b22-333c-0000-ee55555e55ee/0.1.0/file2"></link>
          </head>
          <body></body>
        </html>`

      expect(injectCdnProxy(content, ctx)).toMatchInlineSnapshot(`
        "<html>
                  <head>
                    <script src=\\"/ext/cdn/extensions/1aaaa11a-2b22-333c-4444-ee55555e55ee/0.0.0/assets/file-ext\\"></script>
                    <link href=\\"/ext/cdn/extensions/1aaaa11a-2b22-333c-0000-ee55555e55ee/0.1.0/assets/file-ext?v=123\\"></link>
                    <link href=\\"https://cdn.shopify.com/extensions/1aaaa11a-2b22-333c-0000-ee55555e55ee/0.1.0/file2\\"></link>
                  </head>
                  <body></body>
                </html>"
      `)
    })

    test('proxies urls in JS files', () => {
      const content = `
        console.log('https://cdn.shopify.com/path/to/assets/file1');
        // Comment: https://cdn.shopify.com/path/to/assets/file1 something
        const url = "https://cdn.shopify.com/path/to/assets/file1#zzz";
        fetch(\`https://cdn.shopify.com/path/to/assets/file1?q=123\`);
      `

      expect(injectCdnProxy(content, ctx)).toMatchInlineSnapshot(
        `
        "
                console.log('/cdn/path/to/assets/file1');
                // Comment: /cdn/path/to/assets/file1 something
                const url = \\"/cdn/path/to/assets/file1#zzz\\";
                fetch(\`/cdn/path/to/assets/file1?q=123\`);
              "
      `,
      )
    })

    test('proxies urls in Link header', () => {
      const linkHeader =
        `<https://cdn.shopify.com>; rel="preconnect", <https://cdn.shopify.com>; rel="preconnect"; crossorigin,` +
        `<https://my-store.myshopify.com/cdn/shop/t/10/assets/component-localization-form.css?v=120620094879297847921723560016>; as="style"; rel="preload"`

      expect(injectCdnProxy(linkHeader, ctx)).toMatchInlineSnapshot(
        `"<https://cdn.shopify.com>; rel=\\"preconnect\\", <https://cdn.shopify.com>; rel=\\"preconnect\\"; crossorigin,</cdn/shop/t/10/assets/component-localization-form.css?v=120620094879297847921723560016>; as=\\"style\\"; rel=\\"preload\\""`,
      )
    })
  })

  describe('patchRenderingResponse', () => {
    test('replaces CDN links in body and headers', async () => {
      const event = createH3Event()

      const renderingResponse = new NodeResponse(
        html`<html>
          <head>
            <script src="https://my-store.myshopify.com/cdn/path/to/assets/file1"></script>
            <script src="https://cdn.shopify.com/path/to/assets/file1"></script>
          </head>
          <body>
            <div data-base-url="https://my-store.myshopify.com"></div>
          </body>
        </html>`,
        {
          headers: {
            Link:
              `<https://cdn.shopify.com>; rel="preconnect", <https://cdn.shopify.com>; rel="preconnect"; crossorigin,` +
              `<https://my-store.myshopify.com/cdn/shop/t/10/assets/component-localization-form.css?v=120620094879297847921723560016>; as="style"; rel="preload"`,

            'Set-Cookie':
              'keep_alive=b810fe75-4242-4554-a19c-0a5ecb70e92f; path=/; expires=Fri,' +
              ' 16 Aug 2024 12:16:24 GMT; HttpOnly; SameSite=Lax,' +
              ' secure_customer_sig=; path=/; expires=Sat,' +
              ' 16 Aug 2025 11:46:24 GMT; secure; HttpOnly; SameSite=Lax,' +
              ' localization=ES; path=/; expires=Sat,' +
              ' 16 Aug 2025 11:46:24 GMT; SameSite=Lax,' +
              ' cart_currency=EUR; path=/; expires=Fri,' +
              ' 30 Aug 2024 11:46:24 GMT; SameSite=Lax,' +
              ' _tracking_consent=%7B..%22; domain=my-store.myshopify.com; path=/; expires=Sat,' +
              ' 16 Aug 2025 11:46:24 GMT; SameSite=Lax,' +
              ' _cmp_a=%7B..%22purposes%22%; domain=my-store.myshopify.com; path=/; expires=Sat,' +
              ' 17 Aug 2024 11:46:24 GMT; SameSite=Lax,' +
              ' _shopify_essential=:AZFbAlZ..yAAH:; path=/; Max-Age=31536000; secure; HttpOnly; SameSite=Lax,' +
              ' _shopify_sa_t=; Expires=Thu,' +
              ' 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=my-store.myshopify.com; Path=/; SameSite=Lax,' +
              ' _shopify_sa_p=; Expires=Thu,' +
              ' 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=my-store.myshopify.com; Path=/; SameSite=Lax,' +
              ' _shopify_y=; Expires=Thu,' +
              ' 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=my-store.myshopify.com; Path=/; SameSite=Lax,' +
              ' _shopify_s=; Expires=Thu,' +
              ' 01 Jan 1970 00:00:00 GMT; Max-Age=0; Domain=my-store.myshopify.com; Path=/; SameSite=Lax',
          },
        },
      )

      await expect(patchRenderingResponse(ctx, event, renderingResponse)).resolves.toMatchInlineSnapshot(`
        "<html>
                  <head>
                    <script src=\\"/cdn/path/to/assets/file1\\"></script>
                    <script src=\\"/cdn/path/to/assets/file1\\"></script>
                  </head>
                  <body>
                    <div data-base-url=\\"http://localhost:1337\\"></div>
                  </body>
                </html>"
      `)

      expect(event.node.res.getHeader('link')).toMatchInlineSnapshot(
        `"<https://cdn.shopify.com>; rel=\\"preconnect\\", <https://cdn.shopify.com>; rel=\\"preconnect\\"; crossorigin,</cdn/shop/t/10/assets/component-localization-form.css?v=120620094879297847921723560016>; as=\\"style\\"; rel=\\"preload\\""`,
      )

      expect(event.node.res.getHeader('set-cookie')).toMatchInlineSnapshot(
        `
        [
          "keep_alive=b810fe75-4242-4554-a19c-0a5ecb70e92f; path=/; expires=Fri, 16 Aug 2024 12:16:24 GMT; HttpOnly; SameSite=Lax, secure_customer_sig=; path=/; expires=Sat, 16 Aug 2025 11:46:24 GMT; secure; HttpOnly; SameSite=Lax, localization=ES; path=/; expires=Sat, 16 Aug 2025 11:46:24 GMT; SameSite=Lax, cart_currency=EUR; path=/; expires=Fri, 30 Aug 2024 11:46:24 GMT; SameSite=Lax, _tracking_consent=%7B..%22; path=/; expires=Sat, 16 Aug 2025 11:46:24 GMT; SameSite=Lax, _cmp_a=%7B..%22purposes%22%; path=/; expires=Sat, 17 Aug 2024 11:46:24 GMT; SameSite=Lax, _shopify_essential=:AZFbAlZ..yAAH:; path=/; Max-Age=31536000; secure; HttpOnly; SameSite=Lax, _shopify_sa_t=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax, _shopify_sa_p=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax, _shopify_y=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax, _shopify_s=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; SameSite=Lax",
        ]
      `,
      )

      // Stores _shopify_essential for the following requests
      expect(ctx.session.sessionCookies).toHaveProperty('_shopify_essential', ':AZFbAlZ..yAAH:')
    })
  })

  describe('getProxyStorefrontHeaders', () => {
    test('filters out hop-by-hop headers and adds required headers', () => {
      const event = createH3Event()
      event.context.clientAddress = '42'
      // Removed:
      event.node.req.headers.connection = '...'
      event.node.req.headers['proxy-authenticate'] = '...'
      event.node.req.headers.host = 'abnb'
      // Kept:
      event.node.req.headers.accept = 'text/html'
      event.node.req.headers.cookie = 'oreo'
      event.node.req.headers['user-agent'] = 'vitest'
      event.node.req.headers['x-custom'] = 'true'

      expect(getProxyStorefrontHeaders(event)).toMatchInlineSnapshot(`
        {
          "X-Forwarded-For": "42",
          "accept": "text/html",
          "cookie": "oreo",
          "user-agent": "vitest",
          "x-custom": "true",
        }
      `)
    })
  })

  describe('canProxyRequest', () => {
    test('should proxy non-GET requests', () => {
      const event = createH3Event('POST', '/some-path.html')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy Cart requests as they are not supported by the SFR client', () => {
      const event = createH3Event('GET', '/cart/some-path')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy Checkout requests as they are not supported by the SFR client', () => {
      const event = createH3Event('GET', '/checkouts/xyz')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy CDN requests', () => {
      const event = createH3Event('GET', '/cdn/some-path')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy CDN requests for extensions', () => {
      const event = createH3Event('GET', '/ext/cdn/some-path')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy requests with file extensions', () => {
      const event = createH3Event('GET', '/some-path.js')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy requests with a non-default accept header', () => {
      const event = createH3Event('GET', '/some-path', {accept: 'application/json'})
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should not proxy requests with a default accept header and no extension, allowing them to be rendered by the SFR client', () => {
      const event = createH3Event('GET', '/some-path', {accept: '*/*'})
      expect(canProxyRequest(event)).toBeFalsy()
    })

    test('should not proxy HTML requests (based on the extension), allowing them to be rendered by the SFR client', () => {
      const event = createH3Event('GET', '/some-path.html')
      expect(canProxyRequest(event)).toBeFalsy()
    })

    test('should not proxy HTML requests (based on the "accept" header), allowing them to be rendered by the SFR client', () => {
      const event = createH3Event('GET', '/some-path', {accept: 'text/html'})
      expect(canProxyRequest(event)).toBeFalsy()
    })

    /*
     * "Sign in with Shop" users face an error if the rendering happens via the
     * SFR API (as it results in a broken 200, instead of a 302)
     */
    test('should proxy the /account requests as it may result on a 302 that must be followd', () => {
      const event = createH3Event('GET', '/account')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should not proxy the /account/login requests', () => {
      const event = createH3Event('GET', '/account/login')
      expect(canProxyRequest(event)).toBeFalsy()
    })

    test('should proxy /account/login/multipass and /account/login/multipass/ requests', () => {
      const event = createH3Event('GET', '/account/login/multipass')
      const event2 = createH3Event('GET', '/account/login/multipass/')
      expect(canProxyRequest(event)).toBeTruthy()
      expect(canProxyRequest(event2)).toBeTruthy()
    })

    test('should proxy /account/login/multipass/<token> requests', () => {
      const event = createH3Event('GET', '/account/login/multipass/<token>')
      expect(canProxyRequest(event)).toBeTruthy()
    })

    test('should proxy /account/logout requests', () => {
      const event = createH3Event('GET', '/account/logout')
      expect(canProxyRequest(event)).toBeTruthy()
    })
  })
})

import {injectCdnProxy} from './proxy.js'
import {describe, test, expect} from 'vitest'
import type {DevServerContext} from './types.js'

describe('dev proxy', () => {
  const html = String.raw

  const ctx = {
    session: {storeFqdn: 'my-store.myshopify.com'},
    options: {host: 'localhost', port: '1337'},
    localThemeFileSystem: {files: new Map([['assets/file1', 'content']])},
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
  })
})

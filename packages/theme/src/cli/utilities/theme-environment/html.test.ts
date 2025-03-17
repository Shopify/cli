import {getHtmlHandler} from './html.js'
import {render} from './storefront-renderer.js'
import {DevServerContext} from './types.js'
import {emptyThemeExtFileSystem, emptyThemeFileSystem} from '../theme-fs-empty.js'
import {createEvent} from 'h3'
import {describe, expect, test, vi} from 'vitest'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('./storefront-renderer.js')
vi.mock('./hot-reload/error-page.js')
vi.mock('./hot-reload/server.js')
vi.mock('../theme-ext-environment/theme-ext-server.js')

function createH3Event(method = 'GET', path = '/', headers = {}) {
  const req = new IncomingMessage(new Socket())
  const res = new ServerResponse(req)

  req.method = method
  req.url = path
  req.headers = headers

  return createEvent(req, res)
}

describe('getHtmlHandler', async () => {
  const theme = {id: '123'} as unknown as Theme
  const session = {
    storeFqdn: 'test.myshopify.com',
    refresh: vi.fn().mockResolvedValue(undefined),
  }
  const ctx = {
    session,
    options: {},
    localThemeExtensionFileSystem: emptyThemeExtFileSystem(),
    localThemeFileSystem: emptyThemeFileSystem(),
  } as unknown as DevServerContext

  test('the development server session recovers when a theme id mismatch occurs', async () => {
    // Given
    const handler = getHtmlHandler(theme, ctx)
    const event = createH3Event('GET', '/?__sfr_test=true&_ab=0&_fd=0&_sc=1')

    vi.mocked(render).mockResolvedValueOnce(
      new Response(
        `<script>
          var Shopify = Shopify || {};
          Shopify.theme = {"name":"Development","id":456,"role":"development"};
        </script>`,

        {
          status: 200,
          headers: {
            'x-request-id': 'test-request-id',
          },
        },
      ),
    )

    // When
    const firstResponse = await handler(event)

    // Then
    expect(firstResponse.status).toBe(302)
    expect(firstResponse.headers.get('Location')).toBe('/?_ab=0&_fd=0&_sc=1')
    expect(ctx.session.refresh).toHaveBeenCalled()
  })

  test('the development server aborts when max theme id mismatch retries is reached', async () => {
    // Given
    const handler = getHtmlHandler(theme, ctx)
    const event = createH3Event('GET', '/')
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    vi.mocked(render).mockImplementation(async () => {
      return new Response(
        `<script>
          var Shopify = Shopify || {};
          Shopify.theme = {"name":"Development","id":456,"role":"development"};
        </script>`,
        {
          status: 200,
          headers: {
            'x-request-id': 'test-request-id',
          },
        },
      )
    })

    // When
    const tooManyRedirects = Array.from({length: 6}, () => handler(event))
    await Promise.all(tooManyRedirects)

    // Then
    expect(mockExit).toHaveBeenCalledWith(1)
    expect(ctx.session.refresh).toHaveBeenCalledTimes(6)
    mockExit.mockRestore()
  })
})

import {getHtmlHandler} from './html.js'
import {render} from './storefront-renderer.js'
import {DevServerContext} from './types.js'
import {emptyThemeExtFileSystem, emptyThemeFileSystem} from '../theme-fs-empty.js'
import {DevSessionOutput} from '../../ui/DevSessionOutput.js'
import {createEvent} from 'h3'
import {describe, expect, test, vi} from 'vitest'
import {renderError} from '@shopify/cli-kit/node/ui'
import {Theme} from '@shopify/cli-kit/node/themes/types'

import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('./storefront-renderer.js')
vi.mock('./hot-reload/error-page.js')
vi.mock('./hot-reload/server.js')
vi.mock('../theme-ext-environment/theme-ext-server.js')
vi.mock('@shopify/cli-kit/node/ui')

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
    lastRequestedPath: '',
  } as unknown as DevServerContext

  test('sets lastRequestedPath when Sec-Fetch-Mode is navigate', async () => {
    const handler = getHtmlHandler(theme, ctx)

    expect(ctx.lastRequestedPath).toStrictEqual('')

    const event = createH3Event('GET', '/search?q=foo&options%5Bprefix%5D=last', {'sec-fetch-mode': 'navigate'})

    vi.mocked(render).mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: {
          'x-request-id': 'test-request-id',
        },
      }),
    )

    await handler(event)

    expect(ctx.lastRequestedPath).toStrictEqual('/search?q=foo&options%5Bprefix%5D=last')
  })

  test('does not update lastRequestedPath when Sec-Fetch-Mode is not navigate', async () => {
    const handler = getHtmlHandler(theme, ctx)
    ctx.lastRequestedPath = '/previous-page'

    const event = createH3Event('GET', '/search/suggest?q=foo&resources[type]=product', {'sec-fetch-mode': 'cors'})

    vi.mocked(render).mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: {'x-request-id': 'test-request-id'},
      }),
    )

    await handler(event)

    expect(ctx.lastRequestedPath).toStrictEqual('/previous-page')
  })

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

  test('renders a per-request render failure via renderError when no sink is provided', async () => {
    // Given
    vi.mocked(renderError).mockClear()
    const handler = getHtmlHandler(theme, ctx)
    const event = createH3Event('GET', '/')
    vi.mocked(render).mockRejectedValueOnce(new Error('render blew up'))

    // When
    await handler(event)

    // Then
    expect(renderError).toHaveBeenCalledTimes(1)
  })

  test('routes a per-request render failure into the sink and not to renderError when a sink is provided', async () => {
    // Given
    vi.mocked(renderError).mockClear()
    const sink = new DevSessionOutput()
    const alertSpy = vi.spyOn(sink, 'alert')
    const sinkCtx = {...ctx, sink} as unknown as DevServerContext
    const handler = getHtmlHandler(theme, sinkCtx)
    const event = createH3Event('GET', '/')
    vi.mocked(render).mockRejectedValueOnce(new Error('render blew up'))

    // When
    await handler(event)

    // Then
    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('Failed to render storefront')}),
    )
    expect(renderError).not.toHaveBeenCalled()
  })
})

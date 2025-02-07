import {DevServerContext} from './types.js'
import {setupDevServer} from './theme-environment.js'
import {render} from './storefront-renderer.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {uploadTheme} from '../theme-uploader.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {emptyThemeExtFileSystem} from '../theme-fs-empty.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {createEvent} from 'h3'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('@shopify/cli-kit/node/themes/api', () => ({fetchChecksums: () => Promise.resolve([])}))
vi.mock('./remote-theme-watcher.js')
vi.mock('./storefront-renderer.js')

// Vitest is resetting this mock between tests due to a global config `mockReset: true`.
// For some reason we need to re-mock it here and in beforeEach:
vi.mock('../theme-uploader.js', async () => {
  return {
    uploadTheme: vi.fn(() => {
      return {
        workPromise: Promise.resolve(),
        uploadResults: new Map(),
        renderThemeSyncProgress: () => Promise.resolve(),
      }
    }),
  }
})
beforeEach(() => {
  vi.mocked(uploadTheme).mockImplementation(() => {
    return {workPromise: Promise.resolve(), uploadResults: new Map(), renderThemeSyncProgress: () => Promise.resolve()}
  })
})

describe('setupDevServer', () => {
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})!
  const localFiles = new Map([
    ['templates/asset.json', {checksum: '1', key: 'templates/asset.json'}],
    [
      'assets/file1.css',
      {
        checksum: '1',
        key: 'assets/file1.css',
        value: '.some-class { background: url("https://cdn.shopify.com/path/to/assets/file2.css") }',
      },
    ],
    [
      'assets/file2.css',
      {
        checksum: '2',
        key: 'assets/file2.css',
        value: '.another-class {}',
      },
    ],
    [
      'assets/file3.css.liquid',
      {
        checksum: '3',
        key: 'assets/file3.css.liquid',
        value: '.some-class {}',
      },
    ],
    [
      'assets/file-with-nbsp.js',
      {
        checksum: '1',
        key: 'assets/file-with-nbsp.js',
        // Contains a non-breaking space
        value: 'const x = "Hello\u00A0World";',
      },
    ],
  ])

  const localThemeFileSystem = fakeThemeFileSystem('tmp', localFiles)
  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const defaultServerContext: DevServerContext = {
    session: {
      storefrontToken: '',
      token: '',
      storeFqdn: 'my-store.myshopify.com',
      sessionCookies: {},
    },
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory: 'tmp',
    options: {
      ignore: ['assets/*.json'],
      only: ['templates/*.liquid'],
      noDelete: true,
      host: '127.0.0.1',
      port: '9292',
      liveReload: 'hot-reload',
      open: false,
      themeEditorSync: false,
      errorOverlay: 'default',
    },
  }

  const targetQuerystring = '_fd=0&pb=0'
  const referer = `https://${defaultServerContext.session.storeFqdn}`

  test('should upload the development theme to remote', async () => {
    // Given
    const context: DevServerContext = {
      ...defaultServerContext,
    }

    // When
    await setupDevServer(developmentTheme, context).workPromise

    // Then
    expect(uploadTheme).toHaveBeenCalledWith(developmentTheme, context.session, [], context.localThemeFileSystem, {
      nodelete: true,
      deferPartialWork: true,
      backgroundWorkCatch: expect.any(Function),
    })
  })

  test('should initialize theme editor sync if themeEditorSync flag is passed', async () => {
    // Given
    const filters = {
      ignore: ['assets/*.json'],
      only: ['templates/*.liquid'],
    }
    const context: DevServerContext = {
      ...defaultServerContext,
      options: {
        ...defaultServerContext.options,
        themeEditorSync: true,
        ...filters,
      },
    }
    vi.mocked(reconcileAndPollThemeEditorChanges).mockResolvedValue({
      updatedRemoteChecksumsPromise: Promise.resolve([]),
      workPromise: Promise.resolve(),
    })

    // When
    await setupDevServer(developmentTheme, context).workPromise

    // Then
    expect(reconcileAndPollThemeEditorChanges).toHaveBeenCalledWith(
      developmentTheme,
      context.session,
      [],
      context.localThemeFileSystem,
      {noDelete: true, ...filters},
    )
  })

  test('should skip deletion of remote files if noDelete flag is passed', async () => {
    // Given
    const context = {
      ...defaultServerContext,
      options: {...defaultServerContext.options, noDelete: true},
    }

    // When
    await setupDevServer(developmentTheme, context).workPromise

    // Then
    expect(uploadTheme).toHaveBeenCalledWith(developmentTheme, context.session, [], context.localThemeFileSystem, {
      nodelete: true,
      deferPartialWork: true,
      backgroundWorkCatch: expect.any(Function),
    })
  })

  describe('request handling', async () => {
    const context = {...defaultServerContext}
    const server = setupDevServer(developmentTheme, context)

    const html = String.raw
    const decoder = new TextDecoder()

    const createH3Event = (options: {url: string; headers?: {[key: string]: string}}) => {
      const req = new IncomingMessage(new Socket())
      req.url = options.url
      if (options.headers) req.headers = options.headers
      const res = new ServerResponse(req)
      return createEvent(req, res)
    }

    const dispatchEvent = async (
      url: string,
      headers?: {[key: string]: string},
    ): Promise<{res: ServerResponse; status: number; body: string | Buffer}> => {
      const event = createH3Event({url, headers})
      const {res} = event.node
      let body = ''
      const resWrite = res.write.bind(res)
      res.write = (chunk) => {
        body ??= ''
        body += decoder.decode(chunk)
        return resWrite(chunk)
      }
      const resEnd = res.end.bind(res)
      res.end = (content) => {
        if (!body) body = content ?? ''
        return resEnd(content)
      }

      await server.dispatchEvent(event)

      if (!body && '_data' in res) {
        // When returning a Response from H3, we get the body here:
        // eslint-disable-next-line require-atomic-updates
        body = await new Response(res._data as ReadableStream).text()
      }

      return {res, status: res.statusCode, body}
    }

    test('mocks known endpoints', async () => {
      await expect(dispatchEvent('/wpm@something')).resolves.toHaveProperty('status', 204)
      await expect(dispatchEvent('/.well-known/shopify/monorail')).resolves.toHaveProperty('status', 204)
      expect(vi.mocked(render)).not.toHaveBeenCalled()
    })

    test('serves proxied local assets', async () => {
      const eventPromise = dispatchEvent('/cdn/somepathhere/assets/file1.css')
      await expect(eventPromise).resolves.not.toThrow()

      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('text/css')
      // The URL is proxied:
      expect(body.toString()).toMatchInlineSnapshot(
        `".some-class { background: url(\\"/cdn/path/to/assets/file2.css\\") }"`,
      )
    })

    test('serves local assets from the root in a backward compatible way', async () => {
      // Also serves assets from the root, similar to what the old server did:
      const eventPromise = dispatchEvent('/assets/file2.css')
      await expect(eventPromise).resolves.not.toThrow()

      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('text/css')
      expect(body.toString()).toMatchInlineSnapshot(`".another-class {}"`)
    })

    test('gets the right content for assets with non-breaking spaces', async () => {
      const eventPromise = dispatchEvent('/cdn/somepathhere/assets/file-with-nbsp.js')
      await expect(eventPromise).resolves.not.toThrow()

      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const {res, body: bodyBuffer} = await eventPromise
      const bodyString = bodyBuffer?.toString() ?? ''
      expect(bodyString).toMatchInlineSnapshot(`"const x = \\"Hello\u00A0World\\";"`)

      // Ensure content-length contains the real length:
      expect(bodyString.length).toEqual(24)
      expect(bodyBuffer.length).toEqual(25)
      expect(res.getHeader('content-length')).toEqual(25)
    })

    test('renders HTML', async () => {
      vi.mocked(render).mockResolvedValueOnce(
        new Response(
          html`<html>
          <head>
            <link href="https://cdn.shopify.com/path/to/assets/file1.css"></link>
          </head>
          <body></body>
        </html>`,
          {
            headers: {
              Link: '<https://cdn.shopify.com/path/to/assets/file1.css>; as="style"; rel="preload"',
              'Content-Type': 'text/html',
            },
          },
        ),
      )

      const eventPromise = dispatchEvent('/', {accept: 'text/html'})
      await expect(eventPromise).resolves.not.toThrow()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('text/html; charset=utf-8')
      expect(res.getHeader('link')).toMatch('</cdn/path/to/assets/file1.css>')
      expect(body).toMatch('link href="/cdn/path/to/assets/file1.css"')
    })

    test('proxies other requests to SFR', async () => {
      const fetchStub = vi.fn(
        async () =>
          new Response('mocked', {
            headers: {'proxy-authorization': 'true', 'content-type': 'application/javascript'},
          }),
      )

      vi.stubGlobal('fetch', fetchStub)

      // --- Unknown endpoint:
      const eventPromise = dispatchEvent('/path/to/something-else.js')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).not.toHaveBeenCalled()

      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        new URL(`https://${defaultServerContext.session.storeFqdn}/path/to/something-else.js?${targetQuerystring}`),
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          headers: {referer},
        }),
      )

      const {res, body} = await eventPromise
      expect(body).toEqual('mocked')
      // Clears headers:
      expect(res.getHeader('proxy-authorization')).toBeFalsy()
      expect(res.getHeader('content-type')).toEqual('application/javascript')

      // --- Unknown assets:
      fetchStub.mockClear()
      await expect(dispatchEvent('/cdn/somepathhere/assets/file42.css')).resolves.not.toThrow()
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        new URL(
          `https://${defaultServerContext.session.storeFqdn}/cdn/somepathhere/assets/file42.css?${targetQuerystring}`,
        ),
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          headers: {referer},
        }),
      )
    })

    test('proxies .css.liquid assets with injected CDN', async () => {
      const fetchStub = vi.fn(
        async () =>
          new Response(
            `.some-class {
              font-family: "My Font";
              src: url(//${defaultServerContext.session.storeFqdn}/cdn/shop/t/img/assets/font.woff2);
            }`,
            {headers: {'content-type': 'text/css'}},
          ),
      )

      vi.stubGlobal('fetch', fetchStub)

      const eventPromise = dispatchEvent('/cdn/shop/t/img/assets/file3.css')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const {body} = await eventPromise
      expect(body).toMatch(`src: url(/cdn/shop/t/img/assets/font.woff2)`)
    })

    test('proxies .js.liquid assets replacing the error query string', async () => {
      const fetchStub = vi.fn(async () => new Response())
      vi.stubGlobal('fetch', fetchStub)
      vi.useFakeTimers()
      const now = Date.now()

      const pathname = '/cdn/shop/t/img/assets/file4.js'
      const eventPromise = dispatchEvent(`${pathname}?1234`)
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).not.toHaveBeenCalled()

      expect(fetchStub).toHaveBeenCalledWith(
        new URL(`https://${defaultServerContext.session.storeFqdn}${pathname}?v=${now}&${targetQuerystring}`),
        expect.any(Object),
      )
    })

    test('falls back to proxying if a rendering request fails with 4xx status', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      fetchStub.mockResolvedValueOnce(new Response(null, {status: 302}))
      vi.mocked(render).mockResolvedValueOnce(new Response(null, {status: 401}))

      const eventPromise = dispatchEvent('/non-renderable-path')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).toHaveBeenCalled()

      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        new URL(`https://${defaultServerContext.session.storeFqdn}/non-renderable-path?${targetQuerystring}`),
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          headers: {referer},
        }),
      )

      await expect(eventPromise).resolves.toHaveProperty('status', 302)
    })

    test('forwards rendering error after proxy failure', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      fetchStub.mockResolvedValueOnce(new Response(null, {status: 404}))
      vi.mocked(render).mockResolvedValueOnce(new Response(null, {status: 401}))

      const eventPromise = dispatchEvent('/non-renderable-path')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).toHaveBeenCalled()

      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        new URL(`https://${defaultServerContext.session.storeFqdn}/non-renderable-path?${targetQuerystring}`),
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          headers: {referer},
        }),
      )

      await expect(eventPromise).resolves.toHaveProperty('status', 401)
    })
  })
})

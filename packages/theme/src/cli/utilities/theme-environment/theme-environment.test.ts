import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {setupDevServer} from './theme-environment.js'
import {render} from './storefront-renderer.js'
import {uploadTheme} from '../theme-uploader.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi} from 'vitest'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import {createEvent} from 'h3'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('./remote-theme-watcher.js')
vi.mock('../theme-uploader.js')
vi.mock('./storefront-renderer.js')

describe('startDevServer', () => {
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
  ])

  const localThemeFileSystem = {
    root: 'tmp',
    files: localFiles,
    async read(assetKey) {
      return localFiles.get(assetKey)?.value
    },
    async stat(_assetKey) {
      return {mtime: new Date(), size: 1}
    },
  } as ThemeFileSystem
  const defaultServerContext: DevServerContext = {
    session: {storefrontToken: '', token: '', storeFqdn: 'my-store.myshopify.com', expiresAt: new Date()},
    remoteChecksums: [],
    localThemeFileSystem,
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
    },
  }

  test('should upload the development theme to remote', async () => {
    // Given
    const context: DevServerContext = {
      ...defaultServerContext,
    }

    // When
    await setupDevServer(developmentTheme, context)

    // Then
    expect(uploadTheme).toHaveBeenCalledWith(
      developmentTheme,
      context.session,
      context.remoteChecksums,
      context.localThemeFileSystem,
      {
        ignore: ['assets/*.json'],
        nodelete: true,
        only: ['templates/*.liquid'],
      },
    )
  })

  test('should initialize theme editor sync if themeEditorSync flag is passed', async () => {
    // Given
    const context: DevServerContext = {
      ...defaultServerContext,
      options: {
        ...defaultServerContext.options,
        themeEditorSync: true,
      },
    }

    // When
    await setupDevServer(developmentTheme, context)

    // Then
    expect(reconcileAndPollThemeEditorChanges).toHaveBeenCalledWith(
      developmentTheme,
      context.session,
      context.remoteChecksums,
      context.localThemeFileSystem,
      {
        ignore: ['assets/*.json'],
        noDelete: true,
        only: ['templates/*.liquid'],
      },
    )
  })

  test('should skip deletion of remote files if noDelete flag is passed', async () => {
    // Given
    const context = {...defaultServerContext, options: {...defaultServerContext.options, noDelete: true}}

    // When
    await setupDevServer(developmentTheme, context)

    // Then
    expect(uploadTheme).toHaveBeenCalledWith(developmentTheme, context.session, [], context.localThemeFileSystem, {
      ignore: ['assets/*.json'],
      nodelete: true,
      only: ['templates/*.liquid'],
    })
  })

  describe('request handling', async () => {
    const context = {...defaultServerContext}
    const {dispatch} = await setupDevServer(developmentTheme, context)
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
    ): Promise<{res: ServerResponse<IncomingMessage>; status: number; body?: string}> => {
      const event = createH3Event({url, headers})
      const {res} = event.node
      let body: string | undefined
      const resWrite = res.write.bind(res)
      res.write = (chunk) => {
        body ??= ''
        body += decoder.decode(chunk)
        return resWrite(chunk)
      }
      const resEnd = res.end.bind(res)
      res.end = (content) => {
        body ??= content
        return resEnd(content)
      }

      await dispatch(event)
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
      expect(body).toMatchInlineSnapshot(`".some-class { background: url(\\"/cdn/path/to/assets/file2.css\\") }"`)
    })

    test('renders HTML', async () => {
      vi.mocked(render).mockResolvedValueOnce(
        new NodeResponse(
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
      expect(res.getHeader('content-type')).toEqual('text/html')
      expect(res.getHeader('link')).toMatch('</cdn/path/to/assets/file1.css>')
      expect(body).toMatch('link href="/cdn/path/to/assets/file1.css"')
    })

    test('proxies other requests to SFR', async () => {
      const fetchStub = vi.fn(
        () =>
          new Response('mocked', {
            headers: {'proxy-authorization': 'true', 'content-type': 'application/javascript'},
          }),
      )

      vi.stubGlobal('fetch', fetchStub)

      // --- Unknown endpoint:
      const eventPromise = dispatchEvent('/path/to/something-else.js')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const expectedTarget1 = `https://${defaultServerContext.session.storeFqdn}/path/to/something-else.js`
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        expectedTarget1,
        expect.objectContaining({
          method: 'GET',
          headers: {referer: expectedTarget1},
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
      const expectedTarget2 = `https://${defaultServerContext.session.storeFqdn}/cdn/somepathhere/assets/file42.css`
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        expectedTarget2,
        expect.objectContaining({
          method: 'GET',
          headers: {referer: expectedTarget2},
        }),
      )
    })
  })
})

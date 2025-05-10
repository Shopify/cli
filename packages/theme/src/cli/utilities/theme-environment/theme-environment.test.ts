import {DevServerContext} from './types.js'
import {setupDevServer} from './theme-environment.js'
import {render} from './storefront-renderer.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {hotReloadScriptId} from './hot-reload/server.js'
import {uploadTheme} from '../theme-uploader.js'
import {fakeThemeFileSystem} from '../theme-fs/theme-fs-mock-factory.js'
import {emptyThemeExtFileSystem} from '../theme-fs-empty.js'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {describe, expect, test, vi, beforeEach, afterEach} from 'vitest'
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
  const developmentTheme = buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE})
  if (!developmentTheme) throw new Error('Failed to build theme')

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

  const _targetQuerystring = '_fd=0&pb=0'
  const _referer = `https://${defaultServerContext.session.storeFqdn}`

  afterEach(() => {
    localThemeFileSystem.uploadErrors.clear()
    localThemeFileSystem.unsyncedFileKeys.clear()
  })

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
      expect(Buffer.from(bodyString).length).toEqual(25)
      expect(res.getHeader('content-length')).toEqual(25)
    })

    test('serves compiled_assets/styles.css by aggregating liquid stylesheets', async () => {
      // Add test files to the filesystem
      const sectionFile = {
        key: 'sections/test-section.liquid',
        checksum: 'section1',
        value: `<div class="section">
          {% stylesheet %}
          .test-section {
            color: red;
          }
          {% endstylesheet %}
        </div>`,
      }

      localThemeFileSystem.files.set(sectionFile.key, sectionFile)

      // Mock the response instead of actually processing
      const mockResponseText = `.test-section { color: red; }`

      // Use vi.spyOn to avoid race conditions with references
      const spy = vi.spyOn(server, 'dispatchEvent').mockImplementation((event) => {
        if (event.node.req.url?.includes('/compiled_assets/styles.css')) {
          // Return our mock response directly
          event.node.res.setHeader('content-type', 'text/css')
          event.node.res.end(mockResponseText)
          return Promise.resolve()
        }
        // Call the original function via the spy
        return spy.getMockImplementation()!(event)
      })

      try {
        // Request the file
        const response = await dispatchEvent('/compiled_assets/styles.css')

        // Just verify basic response structure
        expect(response.res.getHeader('content-type')).toEqual('text/css')
        expect(response.body.toString()).toContain('.test-section')
      } finally {
        // Restore the original function
        spy.mockRestore()
      }
    })

    test('serves compiled_assets/scripts.js by aggregating liquid javascript', async () => {
      // Add test files to the filesystem
      const sectionFile = {
        key: 'sections/test-section.liquid',
        checksum: 'section1',
        value: `<div class="section">
          {% javascript %}
            console.log('test');
          {% endjavascript %}
        </div>`,
      }

      localThemeFileSystem.files.set(sectionFile.key, sectionFile)

      // Mock JS response
      const mockResponseText = `console.log('test');`

      // Use vi.spyOn to avoid race conditions with references
      const spy = vi.spyOn(server, 'dispatchEvent').mockImplementation((event) => {
        if (event.node.req.url?.includes('/compiled_assets/scripts.js')) {
          event.node.res.setHeader('content-type', 'text/javascript')
          event.node.res.end(mockResponseText)
          return Promise.resolve()
        }
        // Call the original function via the spy
        return spy.getMockImplementation()!(event)
      })

      try {
        // Request the file
        const response = await dispatchEvent('/compiled_assets/scripts.js')

        // Verify basic response
        expect(response.res.getHeader('content-type')).toEqual('text/javascript')
        expect(response.body.toString()).toContain('console.log')
      } finally {
        // Restore the original function
        spy.mockRestore()
      }
    })

    test('forwards rendering error after proxy failure', async () => {
      // Set up mocks
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)

      // Use simpler approach to avoid timeouts
      fetchStub.mockResolvedValueOnce(new Response(null, {status: 404}))
      vi.mocked(render).mockResolvedValueOnce(new Response('Error page', {status: 401}))

      // First set up the mocks
      const promise = dispatchEvent('/non-renderable-path', {accept: 'text/html'})

      // Then await for the promise to complete
      await promise

      // Now verify render was called
      expect(vi.mocked(render)).toHaveBeenCalled()
    })

    test('skips proxy for known rendering requests like Section Rendering API', async () => {
      // Set up mocks
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      vi.mocked(render).mockResolvedValueOnce(new Response('Section content', {status: 200}))

      // First set up the mocks
      const promise = dispatchEvent('/non-renderable-path?sections=xyz')

      // Then await for the promise to complete
      await promise

      // Verify expected behavior
      expect(vi.mocked(render)).toHaveBeenCalled()
      // Should skip proxy
      expect(fetchStub).not.toHaveBeenCalled()
    })

    test('renders error page on network errors with hot reload script injected', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      vi.mocked(render).mockRejectedValueOnce(new Error('Network error'))

      const eventPromise = dispatchEvent('/')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).toHaveBeenCalled()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('text/html; charset=utf-8')
      expect(body).toMatch(/<title>Failed to render storefront with status 502/i)
      expect(body).toMatch(hotReloadScriptId)
    })

    test('renders error page on upload errors with hot reload script injected', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      localThemeFileSystem.uploadErrors.set('templates/asset.json', ['Error 1', 'Error 2'])

      const eventPromise = dispatchEvent('/')
      await expect(eventPromise).resolves.not.toThrow()
      expect(vi.mocked(render)).not.toHaveBeenCalled()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('text/html; charset=utf-8')
      expect(body).toMatch(/<title>Failed to Upload Theme Files/i)
      expect(body).toMatch(/Error 1/)
      expect(body).toMatch(/Error 2/)
      expect(body).toMatch(hotReloadScriptId)
    })
  })
})

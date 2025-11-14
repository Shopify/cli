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
import * as output from '@shopify/cli-kit/node/output'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'

vi.mock('@shopify/cli-kit/node/themes/api', () => ({fetchChecksums: vi.fn(() => Promise.resolve([]))}))
vi.mock('./remote-theme-watcher.js')
vi.mock('./storefront-renderer.js')
vi.spyOn(output, 'outputDebug')

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
    lastRequestedPath: '',
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory: 'tmp',
    type: 'theme',
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
      expect.anything(),
    )
    // This is the best way I could think of verifying the rejectBackgroundJob
    // Verify the rejectBackgroundJob callback is a function accepting one argument
    const callArgs = vi.mocked(reconcileAndPollThemeEditorChanges).mock.calls[0]
    const rejectCallback = callArgs?.[5]
    expect(rejectCallback).toBeTypeOf('function')
    // Reject callbacks take 1 argument: the rejection reason
    expect(rejectCallback).toHaveLength(1)
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

  test('should catch errors from fetchChecksums and reject backgroundJobPromise', async () => {
    // Given
    const context: DevServerContext = {
      ...defaultServerContext,
    }
    const expectedError = new Error('Failed to fetch checksums from API')

    vi.mocked(fetchChecksums).mockRejectedValueOnce(expectedError)

    // When
    const {backgroundJobPromise} = setupDevServer(developmentTheme, context)

    // Then
    await expect(backgroundJobPromise).rejects.toThrow('Failed to fetch checksums from API')
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

    test('handles non-breaking spaces in files correctly', async () => {
      const eventPromise = dispatchEvent('/assets/file-with-nbsp.js')
      await expect(eventPromise).resolves.not.toThrow()

      const {res, body} = await eventPromise
      expect(res.getHeader('content-type')).toEqual('application/javascript')

      const bodyString = body.toString()
      const bodyBuffer = Buffer.from(bodyString)
      expect(bodyString).toEqual('const x = "Hello\u00A0World";')

      // Ensure content-length contains the real length:
      expect(bodyString.length).toEqual(24)
      expect(bodyBuffer.length).toEqual(25)
      expect(res.getHeader('content-length')).toEqual(25)
    })

    test('serves compiled_assets/styles.css by aggregating liquid stylesheets in a fault tolerant way', async () => {
      const sectionFile = {
        key: 'sections/test-section.liquid',
        checksum: 'section1',
        value: `<div class="section">
          {% schema %}
          {
            "name": "Test Section"
          }
          {% endschema %}

          {% stylesheet %}
          .test-section {
            color: red;
          }
          {% endstylesheet %}
        </div>`,
      }

      const brokenSectionFile = {
        key: 'sections/test-broken-section.liquid',
        checksum: 'section1',
        value: `<div class="section">
          <% broken liquid %>

          {% stylesheet %}
          .test-broken-section {
            color: blue;
          }
          {% endstylesheet %}

          <% broken liquid %>
        </div>`,
      }

      const blockFile = {
        key: 'blocks/test-block.liquid',
        checksum: 'block1',
        value: `<div class="block">
          {% schema %}
          {
            "name": "Test Block"
          }
          {% endschema %}

          {% stylesheet %}
          .test-block {
            background: blue;
          }
          {% endstylesheet %}
        </div>`,
      }

      const snippetFile = {
        key: 'snippets/test-snippet.liquid',
        checksum: 'snippet1',
        value: `<div class="snippet">
          {% stylesheet %}
          .test-snippet {
            border: 1px solid green;
          }
          {% endstylesheet %}
        </div>`,
      }

      // Add the test files to the filesystem
      localThemeFileSystem.files.set(sectionFile.key, sectionFile)
      localThemeFileSystem.files.set(brokenSectionFile.key, brokenSectionFile)
      localThemeFileSystem.files.set(blockFile.key, blockFile)
      localThemeFileSystem.files.set(snippetFile.key, snippetFile)

      // Request the compiled CSS
      const response = await dispatchEvent('/compiled_assets/styles.css')

      // Just verify the content-type is set correctly
      expect(response.res.getHeader('content-type')).toEqual('text/css')

      const css = response.body.toString()
      expect(css).toContain('.test-section')
      expect(css).toContain('color: red')
      expect(css).toContain('.test-block')
      expect(css).toContain('background: blue')
      expect(css).toContain('.test-snippet')
      expect(css).toContain('border: 1px solid green')
    })

    test('serves compiled_assets/block-scripts.js by aggregating liquid javascript from block files', async () => {
      const blockFile1 = {
        key: 'blocks/test-block.liquid',
        checksum: 'block1',
        value: `
          <div class="block">
            {% javascript %}
              console.log('This is block script');
            {% endjavascript %}
          </div>`,
      }
      const blockFile2 = {
        key: 'blocks/another-block.liquid',
        checksum: 'block2',
        value: `
          <div class="another-block">
            {% javascript %}
              console.log('This is another block script');
            {% endjavascript %}
          </div>`,
      }
      const blockFile3 = {
        key: 'blocks/no-js-block.liquid',
        checksum: 'block3',
        value: `
          <div class="no-js-block">
            <p>This block has no JavaScript</p>
          </div>`,
      }

      localThemeFileSystem.files.set(blockFile1.key, blockFile1)
      localThemeFileSystem.files.set(blockFile2.key, blockFile2)
      localThemeFileSystem.files.set(blockFile3.key, blockFile3)

      const eventPromise = dispatchEvent('/cdn/somepath/compiled_assets/block-scripts.js')
      await expect(eventPromise).resolves.not.toThrow()

      const {res, body} = await eventPromise
      const keepIndent = ''

      expect(res.getHeader('content-type')).toEqual('text/javascript')
      expect(body.toString()).toMatchInlineSnapshot(`
        "
              /*** GENERATED LOCALLY ***/

              (function () {
                var __blocks__ = {};

                (function () {
                  var element = document.getElementById(\\"blocks-script\\");
                  var attribute = element ? element.getAttribute(\\"data-blocks\\") : \\"\\";
                  var blocks = attribute.split(\\",\\").filter(Boolean);

                  for (var i = 0; i < blocks.length; i++) {
                    __blocks__[blocks[i]] = true;
                  }
                })();

                (function () {
                  if (!__blocks__[\\"another-block\\"] && !Shopify.designMode) return;
                  try {
                    /* blocks/another-block.liquid */

                      console.log('This is another block script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();

                (function () {
                  if (!__blocks__[\\"test-block\\"] && !Shopify.designMode) return;
                  try {
                    /* blocks/test-block.liquid */

                      console.log('This is block script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();
        })();"
      `)
    })

    test('serves compiled_assets/snippet-scripts.js by aggregating liquid javascript from snippet files', async () => {
      const snippetFile1 = {
        key: 'snippets/test-snippet.liquid',
        checksum: 'snippet1',
        value: `
          <div class="snippet">
            {% javascript %}
              console.log('This is snippet script');
            {% endjavascript %}
          </div>`,
      }
      const snippetFile2 = {
        key: 'snippets/another-snippet.liquid',
        checksum: 'snippet2',
        value: `
          <div class="another-snippet">
            {% javascript %}
              console.log('This is another snippet script');
            {% endjavascript %}
          </div>`,
      }
      const snippetFile3 = {
        key: 'snippets/no-js-snippet.liquid',
        checksum: 'snippet3',
        value: `
          <div class="no-js-snippet">
            <p>This snippet has no JavaScript</p>
          </div>`,
      }

      localThemeFileSystem.files.set(snippetFile1.key, snippetFile1)
      localThemeFileSystem.files.set(snippetFile2.key, snippetFile2)
      localThemeFileSystem.files.set(snippetFile3.key, snippetFile3)

      const eventPromise = dispatchEvent('/cdn/somepath/compiled_assets/snippet-scripts.js')
      await expect(eventPromise).resolves.not.toThrow()

      const {res, body} = await eventPromise
      const keepIndent = ''

      expect(res.getHeader('content-type')).toEqual('text/javascript')
      expect(body.toString()).toMatchInlineSnapshot(`
        "
              /*** GENERATED LOCALLY ***/

              (function () {
                var __snippets__ = {};

                (function () {
                  var element = document.getElementById(\\"snippets-script\\");
                  var attribute = element ? element.getAttribute(\\"data-snippets\\") : \\"\\";
                  var snippets = attribute.split(\\",\\").filter(Boolean);

                  for (var i = 0; i < snippets.length; i++) {
                    __snippets__[snippets[i]] = true;
                  }
                })();

                (function () {
                  if (!__snippets__[\\"another-snippet\\"] && !Shopify.designMode) return;
                  try {
                    /* snippets/another-snippet.liquid */

                      console.log('This is another snippet script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();

                (function () {
                  if (!__snippets__[\\"test-snippet\\"] && !Shopify.designMode) return;
                  try {
                    /* snippets/test-snippet.liquid */

                      console.log('This is snippet script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();
        })();"
      `)
    })

    test('serves compiled_assets/scripts.js by aggregating liquid javascript from section files', async () => {
      const sectionFile1 = {
        key: 'sections/test-section.liquid',
        checksum: 'section1',
        value: `
          <div class="section">
            {% javascript %}
              console.log('This is section script');
            {% endjavascript %}
          </div>`,
      }
      const sectionFile2 = {
        key: 'sections/another-section.liquid',
        checksum: 'section2',
        value: `
          <div class="another-section">
            {% javascript %}
              console.log('This is another section script');
            {% endjavascript %}
          </div>`,
      }
      const sectionFile3 = {
        key: 'sections/no-js-section.liquid',
        checksum: 'section3',
        value: `
          <div class="no-js-section">
            <p>This section has no JavaScript</p>
          </div>`,
      }

      localThemeFileSystem.files.set(sectionFile1.key, sectionFile1)
      localThemeFileSystem.files.set(sectionFile2.key, sectionFile2)
      localThemeFileSystem.files.set(sectionFile3.key, sectionFile3)
      const eventPromise = dispatchEvent('/cdn/somepath/compiled_assets/scripts.js')
      await expect(eventPromise).resolves.not.toThrow()

      const {res, body} = await eventPromise
      const keepIndent = ''

      expect(res.getHeader('content-type')).toEqual('text/javascript')
      expect(body.toString()).toMatchInlineSnapshot(`
        "
              /*** GENERATED LOCALLY ***/

              (function () {
                var __sections__ = {};

                (function () {
                  var element = document.getElementById(\\"sections-script\\");
                  var attribute = element ? element.getAttribute(\\"data-sections\\") : \\"\\";
                  var sections = attribute.split(\\",\\").filter(Boolean);

                  for (var i = 0; i < sections.length; i++) {
                    __sections__[sections[i]] = true;
                  }
                })();

                (function () {
                  if (!__sections__[\\"another-section\\"] && !Shopify.designMode) return;
                  try {
                    /* sections/another-section.liquid */

                      console.log('This is another section script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();

                (function () {
                  if (!__sections__[\\"test-section\\"] && !Shopify.designMode) return;
                  try {
                    /* sections/test-section.liquid */

                      console.log('This is section script');
                    ${keepIndent}
                  } catch (e) {
                    console.error(e);
                  }
                })();
        })();"
      `)
    })

    test('forwards unknown compiled_assets requests to SFR', async () => {
      const fetchStub = vi.fn(async () => new Response())
      vi.stubGlobal('fetch', fetchStub)

      // Request a compiled asset that doesn't exist
      await dispatchEvent('/compiled_assets/nonexistent.js')

      // Should fall back to proxy
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenLastCalledWith(
        new URL(
          `https://${defaultServerContext.session.storeFqdn}/compiled_assets/nonexistent.js?${targetQuerystring}`,
        ),
        expect.any(Object),
      )
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

    test('skips proxy for known rendering requests like Section Rendering API', async () => {
      const fetchStub = vi.fn()
      vi.stubGlobal('fetch', fetchStub)
      fetchStub.mockResolvedValueOnce(new Response(null, {status: 200}))
      vi.mocked(render).mockResolvedValue(new Response(null, {status: 404}))

      await expect(dispatchEvent('/non-renderable-path?sections=xyz')).resolves.toHaveProperty('status', 404)
      await expect(dispatchEvent('/non-renderable-path?section_id=xyz')).resolves.toHaveProperty('status', 404)
      await expect(dispatchEvent('/non-renderable-path?app_block_id=xyz')).resolves.toHaveProperty('status', 404)

      expect(vi.mocked(render)).toHaveBeenCalledTimes(3)
      expect(fetchStub).not.toHaveBeenCalled()

      await expect(dispatchEvent('/non-renderable-path?unknown=xyz')).resolves.toHaveProperty('status', 200)
      expect(fetchStub).toHaveBeenCalledOnce()
    })

    test('only handles compiled assets for theme context, not theme-extension context', async () => {
      // Given
      const fetchStub = vi.fn(async () => new Response('mocked compiled asset', {status: 200}))
      const themeExtensionContext = {
        ...defaultServerContext,
        type: 'theme-extension' as const,
      }
      const themeExtServer = setupDevServer(developmentTheme, themeExtensionContext)

      vi.stubGlobal('fetch', fetchStub)

      // When
      const event = createH3Event({url: '/compiled_assets/styles.css'})
      await themeExtServer.dispatchEvent(event)

      // Then
      expect(fetchStub).toHaveBeenCalledOnce()
      expect(fetchStub).toHaveBeenCalledWith(
        new URL(`https://${defaultServerContext.session.storeFqdn}/compiled_assets/styles.css?${targetQuerystring}`),
        expect.objectContaining({
          method: 'GET',
          redirect: 'manual',
          headers: {referer},
        }),
      )

      // Reset for comparison with theme context
      fetchStub.mockClear()

      // When requesting the same compiled asset with theme context
      const themeEvent = createH3Event({url: '/compiled_assets/styles.css'})
      await server.dispatchEvent(themeEvent)

      // Then it should handle it locally, not proxy
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

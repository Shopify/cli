import {
  corsMiddleware,
  getExtensionAssetMiddleware,
  getExtensionPayloadMiddleware,
  fileServerMiddleware,
  noCacheMiddleware,
  redirectToDevConsoleMiddleware,
  getExtensionPointMiddleware,
} from './middlewares.js'
import * as utilities from './utilities.js'
import {GetExtensionsMiddlewareOptions} from './models.js'
import * as templates from '../templates.js'
import * as payload from '../payload.js'
import {UIExtensionPayload} from '../payload/models.js'
import {testUIExtension} from '../../../../models/app/app.test-data.js'
import {AppEventWatcher} from '../../app-events/app-event-watcher.js'
import {copyConfigKeyEntry} from '../../../build/steps/include-assets/copy-config-key-entry.js'
import {describe, expect, vi, test} from 'vitest'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import * as h3 from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'

import type {H3Event} from 'h3'

vi.mock('h3', async () => {
  const actual: any = await vi.importActual('h3')
  return {
    ...actual,
    sendRedirect: vi.fn(),
  }
})

function getMockEvent({
  params = {},
  headers = {},
}: {params?: Record<string, string>; headers?: Record<string, string>} = {}) {
  const setHeader = vi.fn()
  const writeHead = vi.fn()
  const end = vi.fn()
  const getHeader = vi.fn()

  const event = {
    method: 'GET',
    path: '/',
    context: {params},
    node: {
      req: {headers},
      res: {
        setHeader,
        writeHead,
        end,
        getHeader,
      },
    },
  }

  return event as unknown as H3Event
}

function getOptions({
  devOptions,
  assetResolvers,
}: {
  devOptions: Partial<GetExtensionsMiddlewareOptions['devOptions']>
  assetResolvers?: Map<string, Map<string, string>>
}) {
  const extensions = devOptions.extensions
  const resolvers = assetResolvers ?? new Map()
  return {
    devOptions,
    payloadStore: {
      getAssetResolver: (devUUID: string) => resolvers.get(devUUID),
    },
    getExtensions: () => extensions,
  } as unknown as GetExtensionsMiddlewareOptions
}

describe('corsMiddleware()', () => {
  test('sets headers to allow cross origin requests', async () => {
    const event = getMockEvent()

    await corsMiddleware(event)

    expect(event.node.res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, OPTIONS')
    expect(event.node.res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
    )
  })
})

describe('noCacheMiddleware()', () => {
  test('sets headers to prevent caching', async () => {
    const event = getMockEvent()

    await noCacheMiddleware(event)

    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
  })
})

describe('redirectToDevConsoleMiddleware()', () => {
  test('redirects to /extensions/dev-console', async () => {
    const event = getMockEvent()

    await redirectToDevConsoleMiddleware(event)

    expect(h3.sendRedirect).toHaveBeenCalledWith(event, '/extensions/dev-console', 307)
  })
})

describe('fileServerMiddleware()', async () => {
  test('returns 404 if file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      await mkdir(joinPath(tmpDir, 'foo'))

      const filePath = joinPath(tmpDir, 'foo', 'missing.file')
      const event = getMockEvent()

      await fileServerMiddleware(event, {filePath})

      expect(utilities.sendError).toHaveBeenCalledWith(event, {
        statusCode: 404,
        statusMessage: `Not Found: ${filePath}`,
      })
    })
  })

  test('returns an index.html for folder paths', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      await mkdir(joinPath(tmpDir, 'foo'))
      await touchFile(joinPath(tmpDir, 'foo', 'index.html'))
      await writeFile(joinPath(tmpDir, 'foo', 'index.html'), '<html></html>')

      const event = getMockEvent()

      const result = await fileServerMiddleware(event, {
        filePath: joinPath(tmpDir, 'foo'),
      })

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html')
      expect(String(result)).toBe('<html></html>')
    })
  })

  test.each([
    ['.ico', 'image/x-icon'],
    ['.html', 'text/html'],
    ['.js', 'text/javascript'],
    ['.json', 'application/json'],
    ['.css', 'text/css'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.wav', 'audio/wav'],
    ['.mp3', 'audio/mpeg'],
    ['.svg', 'image/svg+xml'],
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
  ])('returns %s with ContentType: %s string', async (extension, contentType) => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      const fileName = `bar.${extension}`
      const fileContent = `Content for ${fileName}`

      await mkdir(joinPath(tmpDir, 'foo'))
      await touchFile(joinPath(tmpDir, 'foo', fileName))
      await writeFile(joinPath(tmpDir, 'foo', fileName), fileContent)

      const event = getMockEvent()

      const result = await fileServerMiddleware(event, {
        filePath: joinPath(tmpDir, 'foo', fileName),
      })

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', contentType)
      expect(String(result)).toBe(fileContent)
    })
  })

  test('serves binary files as a Buffer without UTF-8 corruption', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Bytes that are invalid as UTF-8 input (0x89, 0xFF, 0xFE) — if the
      // middleware decoded these as UTF-8 they'd collapse to U+FFFD and the
      // image would be corrupt. Includes the real PNG magic header.
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x42])
      await mkdir(joinPath(tmpDir, 'img'))
      await writeFile(joinPath(tmpDir, 'img', 'logo.png'), pngBytes)

      const event = getMockEvent()
      const result = await fileServerMiddleware(event, {filePath: joinPath(tmpDir, 'img', 'logo.png')})

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(Buffer.isBuffer(result)).toBe(true)
    })
  })

  test('sets Content-Type to text/plain if it does not understand the file extension', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      await mkdir(joinPath(tmpDir, 'foo'))
      await touchFile(joinPath(tmpDir, 'foo', 'bar.foo'))
      await writeFile(joinPath(tmpDir, 'foo', 'bar.foo'), 'Content for bar.foo')

      const event = getMockEvent()

      const result = await fileServerMiddleware(event, {
        filePath: joinPath(tmpDir, 'foo', 'bar.foo'),
      })

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain')
      expect(String(result)).toBe('Content for bar.foo')
    })
  })
})

describe('getExtensionAssetMiddleware()', () => {
  test('returns a 404 if the extensionID is not found', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      const options = getOptions({
        devOptions: {
          extensions: [
            await testUIExtension({
              devUUID: '123abc',
              outputPath: joinPath(tmpDir, 'dist', 'test-ui-extension.js'),
            }),
          ],
        },
      })

      const event = getMockEvent({
        params: {
          extensionId: '456dev',
          assetPath: 'test-ui-extension.js',
        },
      })

      await getExtensionAssetMiddleware(options)(event)

      expect(utilities.sendError).toHaveBeenCalledWith(event, {
        statusCode: 404,
        statusMessage: `Extension with id 456dev not found`,
      })
    })
  })

  test('returns built asset from extension build output directory', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extension = await testUIExtension({directory: tmpDir})

      const options = getOptions({
        devOptions: {
          extensions: [extension],
        },
      })

      // Create the built output file in dist/ (e.g. dist/handle.js)
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      const outputFile = joinPath(outputDir, extension.outputFileName)
      await touchFile(outputFile)
      await writeFile(outputFile, 'compiled bundle content')

      const event = getMockEvent({
        params: {
          extensionId: extension.devUUID,
          assetPath: extension.outputFileName,
        },
      })

      const result = await getExtensionAssetMiddleware(options)(event)

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/javascript')
      expect(String(result)).toBe('compiled bundle content')
    })
  })

  test('returns static asset that include_assets copied into the output directory', async () => {
    // Simulates admin_link/ui_extension: include_assets copies `targeting[].tools`
    // (possibly from outside the extension directory) into outputDir via uniqueBasename.
    // The dev server serves whatever lives there, keyed by the manifest's output-relative name.
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extension = await testUIExtension({directory: tmpDir})

      const options = getOptions({
        devOptions: {
          extensions: [extension],
        },
      })

      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      const fileName = 'tools.json'
      await writeFile(joinPath(outputDir, fileName), '{"tools": []}')

      const event = getMockEvent({
        params: {
          extensionId: extension.devUUID,
          assetPath: fileName,
        },
      })

      const result = await getExtensionAssetMiddleware(options)(event)

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
      expect(String(result)).toBe('{"tools": []}')
    })
  })

  test('returns 404 when the requested file is not present in the output directory', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})
      const extension = await testUIExtension({directory: tmpDir})

      const options = getOptions({
        devOptions: {
          extensions: [extension],
        },
      })

      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)

      const event = getMockEvent({
        params: {
          extensionId: extension.devUUID,
          assetPath: 'never-configured.json',
        },
      })

      await getExtensionAssetMiddleware(options)(event)

      expect(utilities.sendError).toHaveBeenCalledWith(event, expect.objectContaining({statusCode: 404}))
    })
  })

  test('returns 404 for path traversal attempts', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})
      const extension = await testUIExtension({directory: tmpDir})

      const options = getOptions({
        devOptions: {
          extensions: [extension],
        },
      })

      // A file outside outputDir that we want to ensure can't be reached.
      await writeFile(joinPath(tmpDir, 'secret.txt'), 'secret')

      const event = getMockEvent({
        params: {
          extensionId: extension.devUUID,
          assetPath: '../secret.txt',
        },
      })

      await getExtensionAssetMiddleware(options)(event)

      expect(utilities.sendError).toHaveBeenCalledWith(event, {
        statusCode: 404,
        statusMessage: 'Not Found',
      })
    })
  })

  test('serves a ../tools.json source after include_assets flattens it into the output directory', async () => {
    // End-to-end verification of the motivating scenario: a TOML config declares
    // `tools = "../tools.json"` (a path outside the extension directory).
    //   1. include_assets (via copyConfigKeyEntry) copies the outside file into
    //      outputDir under its flat basename.
    //   2. The payload emits an opaque <target>/tools URL and registers a
    //      resolver entry mapping that URL to the flattened filename.
    //   3. The dev server middleware resolves the request against the resolver
    //      and serves the correct file.
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extDir = joinPath(tmpDir, 'ext')
      await mkdir(extDir)

      // Source file lives OUTSIDE the extension directory — addressable from
      // the extension as `../tools.json`.
      const toolsContent = '{"tools":["outside-source"]}'
      await writeFile(joinPath(tmpDir, 'tools.json'), toolsContent)

      // product_subscription's outputRelativePath is `dist/${handle}.js`, so
      // outputDir resolves to `<extDir>/dist`.
      const extension = await testUIExtension({
        directory: extDir,
        configuration: {
          name: 'test-ext',
          type: 'product_subscription',
          handle: 'test-ext',
          metafields: [],
          extension_points: [{target: 'target1', tools: '../tools.json'}],
        } as any,
      })
      const outputDir = joinPath(extDir, 'dist')
      await mkdir(outputDir)

      // Simulate the real include_assets step running against the config.
      const buildResult = await copyConfigKeyEntry({
        key: 'extension_points[].tools',
        baseDir: extDir,
        outputDir,
        context: {extension, options: {stdout: {write: vi.fn()}}} as any,
      })

      const flattened = buildResult.pathMap.get('../tools.json') as string
      expect(flattened).toBe('tools.json')

      // Simulate what payload generation would register for this extension.
      const resolvers = new Map<string, Map<string, string>>()
      resolvers.set(extension.devUUID, new Map([[`target1/tools`, flattened]]))
      const options = getOptions({devOptions: {extensions: [extension]}, assetResolvers: resolvers})

      // Request the opaque URL the payload would have emitted.
      const servedEvent = getMockEvent({
        params: {extensionId: extension.devUUID, assetPath: 'target1/tools'},
      })
      const served = await getExtensionAssetMiddleware(options)(servedEvent)
      expect(String(served)).toBe(toolsContent)

      // The raw "../tools.json" is NOT reachable — outside the outputDir sandbox.
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})
      const traversalEvent = getMockEvent({
        params: {extensionId: extension.devUUID, assetPath: '../tools.json'},
      })
      await getExtensionAssetMiddleware(options)(traversalEvent)
      expect(utilities.sendError).toHaveBeenCalledWith(traversalEvent, {
        statusCode: 404,
        statusMessage: 'Not Found',
      })
    })
  })

  test('serves distinct files for two targets whose source basenames collide', async () => {
    // The motivating regression for the resolver: two extension points both
    // declare a `tools.json` source (one at `../tools.json`, one at
    // `./tools.json`). include_assets disambiguates on disk via uniqueBasename
    // (`tools.json` + `tools-1.json`), and the resolver maps each target's
    // opaque URL to its own file. Requests against `<target>/tools` serve
    // distinct content per target even though the URL shape is uniform.
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extension = await testUIExtension({directory: tmpDir})
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(outputDir)
      await writeFile(joinPath(outputDir, 'tools.json'), '{"source":"outside"}')
      await writeFile(joinPath(outputDir, 'tools-1.json'), '{"source":"inside"}')

      const resolvers = new Map<string, Map<string, string>>()
      resolvers.set(
        extension.devUUID,
        new Map([
          ['target-a/tools', 'tools.json'],
          ['target-b/tools', 'tools-1.json'],
        ]),
      )
      const options = getOptions({devOptions: {extensions: [extension]}, assetResolvers: resolvers})

      const eventA = getMockEvent({params: {extensionId: extension.devUUID, assetPath: 'target-a/tools'}})
      const eventB = getMockEvent({params: {extensionId: extension.devUUID, assetPath: 'target-b/tools'}})

      const servedA = await getExtensionAssetMiddleware(options)(eventA)
      const servedB = await getExtensionAssetMiddleware(options)(eventB)

      expect(String(servedA)).toBe('{"source":"outside"}')
      expect(String(servedB)).toBe('{"source":"inside"}')
    })
  })

  test('serves files from a directory-valued config via the resolver, including nested subdirectories', async () => {
    // Covers `assets = "./assets"` — include_assets copies each file into the
    // bundle, the payload emits a directory-prefix URL, and the resolver has
    // one entry per file so the middleware serves individual fetches.
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extension = await testUIExtension({directory: tmpDir})
      const outputDir = joinPath(tmpDir, 'dist')
      await mkdir(joinPath(outputDir, 'subdir'))
      await writeFile(joinPath(outputDir, 'foo.json'), '{"ok":true}')
      await writeFile(joinPath(outputDir, 'subdir/bar.png'), 'nested')

      const resolvers = new Map<string, Map<string, string>>()
      resolvers.set(
        extension.devUUID,
        new Map([
          ['TARGET/assets/foo.json', 'foo.json'],
          ['TARGET/assets/subdir/bar.png', 'subdir/bar.png'],
        ]),
      )
      const options = getOptions({devOptions: {extensions: [extension]}, assetResolvers: resolvers})

      const rootFile = await getExtensionAssetMiddleware(options)(
        getMockEvent({params: {extensionId: extension.devUUID, assetPath: 'TARGET/assets/foo.json'}}),
      )
      const nestedFile = await getExtensionAssetMiddleware(options)(
        getMockEvent({params: {extensionId: extension.devUUID, assetPath: 'TARGET/assets/subdir/bar.png'}}),
      )

      expect(String(rootFile)).toBe('{"ok":true}')
      expect(String(nestedFile)).toBe('nested')
    })
  })

  test('returns 404 for a resolver-mapped path that escapes the output directory', async () => {
    // A defensive check: even if the resolver somehow produced a malicious
    // value (traversal string, absolute path), the traversal guard still
    // blocks it before any file read.
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})
      const extension = await testUIExtension({directory: tmpDir})
      await writeFile(joinPath(tmpDir, 'secret.txt'), 'secret')

      const resolvers = new Map<string, Map<string, string>>()
      resolvers.set(extension.devUUID, new Map([['evil/tools', '../secret.txt']]))
      const options = getOptions({devOptions: {extensions: [extension]}, assetResolvers: resolvers})

      const event = getMockEvent({params: {extensionId: extension.devUUID, assetPath: 'evil/tools'}})
      await getExtensionAssetMiddleware(options)(event)

      expect(utilities.sendError).toHaveBeenCalledWith(event, {
        statusCode: 404,
        statusMessage: 'Not Found',
      })
    })
  })
})

describe('getExtensionPayloadMiddleware()', () => {
  test('returns a 404 if the extension is not found', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const actualExtensionId = '123abc'
    const requestedExtensionId = '456dev'
    const options = getOptions({
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: actualExtensionId,
          }),
        ],
      },
    })

    const event = getMockEvent({
      params: {
        extensionId: requestedExtensionId,
      },
    })

    await getExtensionPayloadMiddleware(options)(event)

    expect(utilities.sendError).toHaveBeenCalledWith(event, {
      statusCode: 404,
      statusMessage: `Extension with id ${requestedExtensionId} not found`,
    })
  })

  describe('if the accept header starts with text/html', () => {
    test('returns html if the extension surface is post_purchase', async () => {
      vi.spyOn(templates, 'getHTML').mockResolvedValue('mock html')
      vi.spyOn(utilities, 'getExtensionUrl').mockReturnValue('http://www.mock.com/extension/url')

      const extensionId = '123abc'
      const options = getOptions({
        devOptions: {
          url: 'http://mock.url',
          extensions: [
            await testUIExtension({
              configuration: {type: 'checkout_post_purchase', name: 'name', metafields: []},
              devUUID: extensionId,
            }),
          ],
        },
      })

      const event = getMockEvent({
        headers: {
          accept: 'text/html',
        },
        params: {
          extensionId,
        },
      })

      const result = await getExtensionPayloadMiddleware(options)(event)

      expect(templates.getHTML).toHaveBeenCalledWith({
        data: {
          url: 'http://www.mock.com/extension/url',
        },
        template: 'index',
        extensionSurface: 'post_purchase',
      })

      expect(result).toBe('mock html')
    })

    test('returns the redirect URL if the extension surface is not post_purchase', async () => {
      vi.spyOn(utilities, 'getRedirectUrl').mockReturnValue('http://www.mock.com/redirect/url')

      const extensionId = '123abc'
      const options = getOptions({
        devOptions: {
          url: 'http://mock.url',
          storeFqdn: 'mock-store.myshopify.com',
          extensions: [
            await testUIExtension({
              devUUID: extensionId,
              configuration: {
                name: 'name',
                metafields: [],
                type: 'checkout_ui_extension',
              },
            }),
          ],
        },
      })

      const event = getMockEvent({
        headers: {
          accept: 'text/html',
        },
        params: {
          extensionId,
        },
      })

      await getExtensionPayloadMiddleware(options)(event)

      expect(h3.sendRedirect).toHaveBeenCalledWith(event, 'http://www.mock.com/redirect/url', 307)
    })
  })

  describe('if the accept header is not text/html', () => {
    test('returns the app JSON', async () => {
      vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({
        mock: 'extension payload',
      } as unknown as UIExtensionPayload)

      const extensionId = '123abc'
      const options = getOptions({
        devOptions: {
          url: 'http://mock.url',
          storeFqdn: 'mock-store.myshopify.com',
          apiKey: 'mock-api-key',
          extensions: [
            await testUIExtension({
              devUUID: extensionId,
            }),
          ],
          manifestVersion: '3',
          appWatcher: {
            buildOutputPath: 'mock-build-output-path',
          } as unknown as AppEventWatcher,
        },
      })

      const event = getMockEvent({
        params: {
          extensionId,
        },
      })

      const result = await getExtensionPayloadMiddleware(options)(event)

      expect(event.node.res.setHeader).toHaveBeenCalledWith('content-type', 'application/json')
      expect(result).toEqual({
        app: {
          apiKey: 'mock-api-key',
        },
        version: '3',
        root: {
          url: 'http://mock.url/extensions',
        },
        socket: {
          url: 'wss://mock.url/extensions',
        },
        devConsole: {
          url: 'http://mock.url/extensions/dev-console',
        },
        store: 'mock-store.myshopify.com',
        extension: {
          mock: 'extension payload',
        },
      })
    })
  })
})

describe('getExtensionPointMiddleware()', () => {
  test('returns a 404 if the extension is not found', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const actualExtensionId = '123abc'
    const requestedExtensionId = '456dev'
    const options = getOptions({
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: actualExtensionId,
          }),
        ],
      },
    })

    const event = getMockEvent({
      params: {
        extensionId: requestedExtensionId,
      },
    })

    await getExtensionPointMiddleware(options)(event)

    expect(utilities.sendError).toHaveBeenCalledWith(event, {
      statusCode: 404,
      statusMessage: `Extension with id ${requestedExtensionId} not found`,
    })
  })

  test('returns a 404 if requested extension target is not configured', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const extensionId = '123abc'
    const requestedExtensionPointTarget = 'Admin::CheckoutEditor::RenderSettings'
    const options = getOptions({
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: extensionId,
            configuration: {
              name: 'testName',
              type: 'ui_extension',
              metafields: [],
              extension_points: [
                {
                  target: 'Checkout::Dynamic::Render',
                },
              ],
            },
          }),
        ],
      },
    })

    const event = getMockEvent({
      params: {
        extensionId,
        extensionPointTarget: requestedExtensionPointTarget,
      },
    })

    await getExtensionPointMiddleware(options)(event)

    expect(utilities.sendError).toHaveBeenCalledWith(event, {
      statusCode: 404,
      statusMessage: `Extension with id ${extensionId} has not configured the "${requestedExtensionPointTarget}" extension target`,
    })
  })

  test('returns a 404 if requested extension target is invalid and no redirect url can be constructed', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const extensionId = '123abc'
    const extensionPointTarget = 'abc'
    const options = getOptions({
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: extensionId,
            configuration: {
              name: 'testName',
              type: 'ui_extension',
              metafields: [],
              extension_points: [
                {
                  target: extensionPointTarget,
                },
              ],
            },
          }),
        ],
      },
    })

    const event = getMockEvent({
      params: {
        extensionId,
        extensionPointTarget,
      },
    })

    await getExtensionPointMiddleware(options)(event)

    expect(utilities.sendError).toHaveBeenCalledWith(event, {
      statusCode: 404,
      statusMessage: `Redirect url can't be constructed for extension with id ${extensionId} and extension target "${extensionPointTarget}"`,
    })
  })

  test('returns the redirect URL if the requested extension target is configured', async () => {
    vi.spyOn(utilities, 'getRedirectUrl').mockReturnValue('http://www.mock.com/redirect/url')

    const extensionId = '123abc'
    const extensionPointTarget = 'Checkout::Dynamic::Render'
    const options = getOptions({
      devOptions: {
        url: 'http://mock.url',
        storeFqdn: 'mock-store.myshopify.com',
        extensions: [
          await testUIExtension({
            devUUID: extensionId,
            configuration: {
              name: 'testName',
              type: 'ui_extension',
              metafields: [],
              extension_points: [
                {
                  target: extensionPointTarget,
                },
              ],
            },
          }),
        ],
      },
    })

    const event = getMockEvent({
      headers: {
        accept: 'text/html',
      },
      params: {
        extensionId,
        extensionPointTarget,
      },
    })

    await getExtensionPayloadMiddleware(options)(event)

    expect(h3.sendRedirect).toHaveBeenCalledWith(event, 'http://www.mock.com/redirect/url', 307)
  })
})

import {
  corsMiddleware,
  getAppAssetsMiddleware,
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
import {describe, expect, vi, test} from 'vitest'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import * as h3 from 'h3'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

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

function getOptions({devOptions}: {devOptions: Partial<GetExtensionsMiddlewareOptions['devOptions']>}) {
  const extensions = devOptions.extensions
  return {
    devOptions,
    payloadStore: {},
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
  // eslint-disable-next-line vitest/no-disabled-tests
  test.skip('returns 404 if file does not exist', async () => {
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
      expect(result).toBe('<html></html>')
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
      expect(result).toBe(fileContent)
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
      expect(result).toBe('Content for bar.foo')
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

  test('returns the file for that asset path', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      const extension = await testUIExtension({})
      const outputPath = extension.getOutputPathForDirectory(tmpDir)

      const options = getOptions({
        devOptions: {
          extensions: [extension],
          appWatcher: {
            buildOutputPath: tmpDir,
          } as unknown as AppEventWatcher,
        },
      })

      const fileName = 'test-ui-extension.js'

      await mkdir(dirname(outputPath))
      await touchFile(outputPath)
      await writeFile(outputPath, `content from ${fileName}`)

      const event = getMockEvent({
        params: {
          extensionId: extension.devUUID,
          assetPath: fileName,
        },
      })

      const result = await getExtensionAssetMiddleware(options)(event)

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/javascript')
      expect(result).toBe(`content from ${fileName}`)
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

describe('getAppAssetsMiddleware()', () => {
  test('serves a file from the matching asset directory', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      const assetDir = joinPath(tmpDir, 'public')
      await mkdir(assetDir)
      await writeFile(joinPath(assetDir, 'icon.png'), 'png-content')

      const middleware = getAppAssetsMiddleware(() => ({staticRoot: assetDir}))

      const event = getMockEvent({
        params: {assetKey: 'staticRoot', filePath: 'icon.png'},
      })

      const result = await middleware(event)

      expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png')
      expect(result).toBe('png-content')
    })
  })

  test('returns 404 for an unknown asset key', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const middleware = getAppAssetsMiddleware(() => ({staticRoot: '/some/path'}))

    const event = getMockEvent({
      params: {assetKey: 'unknown', filePath: 'icon.png'},
    })

    await middleware(event)

    expect(utilities.sendError).toHaveBeenCalledWith(event, {
      statusCode: 404,
      statusMessage: 'No app assets configured for key: unknown',
    })
  })
})

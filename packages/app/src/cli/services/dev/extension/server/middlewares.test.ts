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
import {describe, expect, vi, test} from 'vitest'
import {inTemporaryDirectory, mkdir, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import * as h3 from 'h3'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

vi.mock('h3', async () => {
  const actual: any = await vi.importActual('h3')
  return {
    ...actual,
    send: vi.fn(),
    sendRedirect: vi.fn(),
  }
})

function getMockRequest({context = {}, headers = {}}) {
  const request = {
    context,
    headers,
  }

  return request as unknown as h3.IncomingMessage
}

function getMockResponse() {
  const setHeader = vi.fn()
  const writeHead = vi.fn()
  const end = vi.fn()
  const getHeader = vi.fn()

  const response = {
    setHeader,
    writeHead,
    end,
    event: {
      res: {
        setHeader,
        end,
        getHeader,
      },
    },
  }

  return response as unknown as h3.ServerResponse
}

function getMockNext() {
  const next = vi.fn()

  return next as unknown as (err?: Error) => unknown
}

describe('corsMiddleware()', () => {
  test('sets headers to allow cross origin requests', () => {
    const response = getMockResponse()

    corsMiddleware(getMockRequest({}), response, getMockNext())

    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
    expect(response.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, OPTIONS')
    expect(response.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
    )
  })
})

describe('noCacheMiddleware()', () => {
  test('sets headers to prevent caching', () => {
    const response = getMockResponse()

    noCacheMiddleware(getMockRequest({}), response, getMockNext())

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
  })
})

describe('redirectToDevConsoleMiddleware()', () => {
  test('redirects to /extensions/dev-console', async () => {
    const response = getMockResponse()

    await redirectToDevConsoleMiddleware(getMockRequest({}), response, getMockNext())

    expect(h3.sendRedirect).toHaveBeenCalledWith(response.event, '/extensions/dev-console', 307)
  })
})

describe('fileServerMiddleware()', async () => {
  // eslint-disable-next-line vitest/no-disabled-tests
  test.skip('returns 404 if file does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      await mkdir(joinPath(tmpDir, 'foo'))

      const filePath = joinPath(tmpDir, 'foo', 'missing.file')
      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), getMockResponse(), getMockNext(), {
        filePath,
      })

      expect(utilities.sendError).toHaveBeenCalledWith(response, {
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

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: joinPath(tmpDir, 'foo'),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html')
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith('<html></html>')
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

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: joinPath(tmpDir, 'foo', fileName),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', contentType)
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith(fileContent)
    })
  })

  test('sets Content-Type to text/plain if it does not understand the file extension', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      await mkdir(joinPath(tmpDir, 'foo'))
      await touchFile(joinPath(tmpDir, 'foo', 'bar.foo'))
      await writeFile(joinPath(tmpDir, 'foo', 'bar.foo'), 'Content for bar.foo')

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: joinPath(tmpDir, 'foo', 'bar.foo'),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain')
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith('Content for bar.foo')
    })
  })
})

describe('getExtensionAssetMiddleware()', () => {
  test('returns a 404 if the extensionID is not found', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      const options = {
        devOptions: {
          extensions: [
            await testUIExtension({
              devUUID: '123abc',
              outputPath: joinPath(tmpDir, 'dist', 'test-ui-extension.js'),
            }),
          ],
        },
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      const response = getMockResponse()

      await getExtensionAssetMiddleware(options)(
        getMockRequest({
          context: {
            params: {
              extensionId: '456dev',
              assetPath: 'test-ui-extension.js',
            },
          },
        }),
        response,
        getMockNext(),
      )

      expect(utilities.sendError).toHaveBeenCalledWith(response, {
        statusCode: 404,
        statusMessage: `Extension with id 456dev not found`,
      })
    })
  })

  test('returns the file for that asset path', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      const response = getMockResponse()
      const fileName = 'test-ui-extension.js'
      const extension = await testUIExtension({})
      const outputPath = extension.getOutputPathForDirectory(tmpDir)
      const options = {
        devOptions: {
          extensions: [extension],
          appWatcher: {
            buildOutputPath: tmpDir,
          },
        },
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      await mkdir(dirname(outputPath))
      await touchFile(outputPath)
      await writeFile(outputPath, `content from ${fileName}`)

      await getExtensionAssetMiddleware(options)(
        getMockRequest({
          context: {
            params: {
              extensionId: extension.devUUID,
              assetPath: fileName,
            },
          },
        }),
        response,
        getMockNext(),
      )

      expect(response.setHeader('Content-Type', 'text/javascript'))
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith(`content from ${fileName}`)
    })
  })
})

describe('getExtensionPayloadMiddleware()', () => {
  test('returns a 404 if the extension is not found', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const actualExtensionId = '123abc'
    const requestedExtensionId = '456dev'
    const options = {
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: actualExtensionId,
          }),
        ],
      },
      payloadStore: {},
    } as unknown as GetExtensionsMiddlewareOptions

    const response = getMockResponse()

    await getExtensionPayloadMiddleware(options)(
      getMockRequest({
        context: {
          params: {
            extensionId: requestedExtensionId,
          },
        },
      }),
      response,
      getMockNext(),
    )

    expect(utilities.sendError).toHaveBeenCalledWith(response, {
      statusCode: 404,
      statusMessage: `Extension with id ${requestedExtensionId} not found`,
    })
  })

  describe('if the accept header starts with text/html', () => {
    test('returns html if the extension surface is post_purchase', async () => {
      vi.spyOn(templates, 'getHTML').mockResolvedValue('mock html')
      vi.spyOn(utilities, 'getExtensionUrl').mockReturnValue('http://www.mock.com/extension/url')

      const extensionId = '123abc'
      const options = {
        devOptions: {
          url: 'http://mock.url',
          extensions: [
            await testUIExtension({
              configuration: {type: 'checkout_post_purchase', name: 'name', metafields: []},
              devUUID: extensionId,
            }),
          ],
        },
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      const response = getMockResponse()

      await getExtensionPayloadMiddleware(options)(
        getMockRequest({
          headers: {
            accept: 'text/html',
          },
          context: {
            params: {
              extensionId,
            },
          },
        }),
        response,
        getMockNext(),
      )

      expect(templates.getHTML).toHaveBeenCalledWith({
        data: {
          url: 'http://www.mock.com/extension/url',
        },
        template: 'index',
        extensionSurface: 'post_purchase',
      })

      expect(h3.send).toHaveBeenCalledWith(response.event, 'mock html')
    })

    test('returns the redirect URL if the extension surface is not post_purchase', async () => {
      vi.spyOn(utilities, 'getRedirectUrl').mockReturnValue('http://www.mock.com/redirect/url')

      const extensionId = '123abc'
      const options = {
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
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      const response = getMockResponse()

      await getExtensionPayloadMiddleware(options)(
        getMockRequest({
          headers: {
            accept: 'text/html',
          },
          context: {
            params: {
              extensionId,
            },
          },
        }),
        response,
        getMockNext(),
      )

      expect(h3.sendRedirect).toHaveBeenCalledWith(response.event, 'http://www.mock.com/redirect/url', 307)
    })
  })

  describe('if the accept header is not text/html', () => {
    test('returns the app JSON', async () => {
      vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({
        mock: 'extension payload',
      } as unknown as UIExtensionPayload)

      const extensionId = '123abc'
      const options = {
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
          },
        },
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      const response = getMockResponse()

      await getExtensionPayloadMiddleware(options)(
        getMockRequest({
          context: {
            params: {
              extensionId,
            },
          },
        }),
        response,
        getMockNext(),
      )

      expect(response.setHeader).toHaveBeenCalledWith('content-type', 'application/json')
      expect(response.end).toHaveBeenCalledWith(
        JSON.stringify({
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
        }),
      )
    })
  })
})

describe('getExtensionPointMiddleware()', () => {
  test('returns a 404 if the extension is not found', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const actualExtensionId = '123abc'
    const requestedExtensionId = '456dev'
    const options = {
      devOptions: {
        url: 'http://mock.url',
        extensions: [
          await testUIExtension({
            devUUID: actualExtensionId,
          }),
        ],
      },
      payloadStore: {},
    } as unknown as GetExtensionsMiddlewareOptions

    const response = getMockResponse()

    await getExtensionPointMiddleware(options)(
      getMockRequest({
        context: {
          params: {
            extensionId: requestedExtensionId,
          },
        },
      }),
      response,
      getMockNext(),
    )

    expect(utilities.sendError).toHaveBeenCalledWith(response, {
      statusCode: 404,
      statusMessage: `Extension with id ${requestedExtensionId} not found`,
    })
  })

  test('returns a 404 if requested extension target is not configured', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const extensionId = '123abc'
    const requestedExtensionPointTarget = 'Admin::CheckoutEditor::RenderSettings'
    const options = {
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
      payloadStore: {},
    } as unknown as GetExtensionsMiddlewareOptions

    const response = getMockResponse()

    await getExtensionPointMiddleware(options)(
      getMockRequest({
        context: {
          params: {
            extensionId,
            extensionPointTarget: requestedExtensionPointTarget,
          },
        },
      }),
      response,
      getMockNext(),
    )

    expect(utilities.sendError).toHaveBeenCalledWith(response, {
      statusCode: 404,
      statusMessage: `Extension with id ${extensionId} has not configured the "${requestedExtensionPointTarget}" extension target`,
    })
  })

  test('returns a 404 if requested extension target is invalid and no redirect url can be constructed', async () => {
    vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

    const extensionId = '123abc'
    const extensionPointTarget = 'abc'
    const options = {
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
      payloadStore: {},
    } as unknown as GetExtensionsMiddlewareOptions

    const response = getMockResponse()

    await getExtensionPointMiddleware(options)(
      getMockRequest({
        context: {
          params: {
            extensionId,
            extensionPointTarget,
          },
        },
      }),
      response,
      getMockNext(),
    )

    expect(utilities.sendError).toHaveBeenCalledWith(response, {
      statusCode: 404,
      statusMessage: `Redirect url can't be constructed for extension with id ${extensionId} and extension target "${extensionPointTarget}"`,
    })
  })

  test('returns the redirect URL if the requested extension target is configured', async () => {
    vi.spyOn(utilities, 'getRedirectUrl').mockReturnValue('http://www.mock.com/redirect/url')

    const extensionId = '123abc'
    const extensionPointTarget = 'Checkout::Dynamic::Render'
    const options = {
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
      payloadStore: {},
    } as unknown as GetExtensionsMiddlewareOptions

    const response = getMockResponse()

    await getExtensionPayloadMiddleware(options)(
      getMockRequest({
        headers: {
          accept: 'text/html',
        },
        context: {
          params: {
            extensionId,
            extensionPointTarget,
          },
        },
      }),
      response,
      getMockNext(),
    )

    expect(h3.sendRedirect).toHaveBeenCalledWith(response.event, 'http://www.mock.com/redirect/url', 307)
  })
})

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
import {testUIExtension} from '../../../../models/app/app.test-data.js'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {http, file, path} from '@shopify/cli-kit'
import {describe, expect, it, vi} from 'vitest'

function getMockRequest({context = {}, headers = {}}) {
  const request = {
    context,
    headers,
  }

  return request as unknown as http.IncomingMessage
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

  return response as unknown as http.ServerResponse
}

function getMockNext() {
  const next = vi.fn()

  return next as unknown as (err?: Error) => unknown
}

describe('corsMiddleware()', () => {
  it('sets headers to allow cross origin requests', () => {
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
  it('sets headers to prevent caching', () => {
    const response = getMockResponse()

    noCacheMiddleware(getMockRequest({}), response, getMockNext())

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache')
  })
})

describe('redirectToDevConsoleMiddleware()', () => {
  it('redirects to /extensions/dev-console', async () => {
    vi.spyOn(http, 'sendRedirect')

    const response = getMockResponse()

    await redirectToDevConsoleMiddleware(getMockRequest({}), response, getMockNext())

    expect(http.sendRedirect).toHaveBeenCalledWith(response.event, '/extensions/dev-console', 307)
  })
})

describe('fileServerMiddleware()', async () => {
  it.skip('returns 404 if file does not exist', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      await file.mkdir(path.join(tmpDir, 'foo'))

      const filePath = path.join(tmpDir, 'foo', 'missing.file')
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

  it('returns an index.html for folder paths', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      await file.mkdir(path.join(tmpDir, 'foo'))
      await file.touch(path.join(tmpDir, 'foo', 'index.html'))
      await file.write(path.join(tmpDir, 'foo', 'index.html'), '<html></html>')

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: path.join(tmpDir, 'foo'),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html')
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith('<html></html>')
    })
  })

  it.each([
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
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      const fileName = `bar.${extension}`
      const fileContent = `Content for ${fileName}`

      await file.mkdir(path.join(tmpDir, 'foo'))
      await file.touch(path.join(tmpDir, 'foo', fileName))
      await file.write(path.join(tmpDir, 'foo', fileName), fileContent)

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: path.join(tmpDir, 'foo', fileName),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', contentType)
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith(fileContent)
    })
  })

  it('sets Content-Type to text/plain if it does not understand the file extension', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      await file.mkdir(path.join(tmpDir, 'foo'))
      await file.touch(path.join(tmpDir, 'foo', 'bar.foo'))
      await file.write(path.join(tmpDir, 'foo', 'bar.foo'), 'Content for bar.foo')

      const response = getMockResponse()

      await fileServerMiddleware(getMockRequest({}), response, getMockNext(), {
        filePath: path.join(tmpDir, 'foo', 'bar.foo'),
      })

      expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain')
      expect(response.writeHead).toHaveBeenCalledWith(200)
      expect(response.end).toHaveBeenCalledWith('Content for bar.foo')
    })
  })
})

describe('getExtensionAssetMiddleware()', () => {
  it('returns a 404 if the extensionID is not found', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      vi.spyOn(utilities, 'sendError').mockImplementation(() => {})

      const options = {
        devOptions: {
          extensions: [
            await testUIExtension({
              devUUID: '123abc',
              outputBundlePath: path.join(tmpDir, 'dist', 'main.js'),
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
              assetPath: 'main.js',
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

  it('returns the file for that asset path', async () => {
    await file.inTemporaryDirectory(async (tmpDir: string) => {
      const response = getMockResponse()
      const devUUID = '123abc'
      const fileName = 'main.js'
      const outputBundlePath = path.join(tmpDir, devUUID, fileName)
      const options = {
        devOptions: {
          extensions: [
            {
              devUUID,
              outputBundlePath,
            },
          ],
        },
        payloadStore: {},
      } as unknown as GetExtensionsMiddlewareOptions

      await file.mkdir(path.join(tmpDir, devUUID))
      await file.touch(outputBundlePath)
      await file.write(outputBundlePath, `content from ${fileName}`)

      await getExtensionAssetMiddleware(options)(
        getMockRequest({
          context: {
            params: {
              extensionId: devUUID,
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
  it('returns a 404 if the extension is not found', async () => {
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
    it('returns html if the extension surface is post-checkout', async () => {
      vi.spyOn(http, 'send')
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
        extensionSurface: 'post-checkout',
      })

      expect(http.send).toHaveBeenCalledWith(response.event, 'mock html')
    })

    it('returns the redirect URL if the extension surface is not post-checkout', async () => {
      vi.spyOn(http, 'sendRedirect')
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

      expect(http.sendRedirect).toHaveBeenCalledWith(response.event, 'http://www.mock.com/redirect/url', 307)
    })
  })

  describe('if the accept header is not text/html', () => {
    it('returns the app JSON', async () => {
      vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({
        mock: 'extension payload',
      } as unknown as ExtensionPayload)

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
  it('returns a 404 if the extension is not found', async () => {
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

  it('returns a 404 if requested extension point target is not configured', async () => {
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
              extensionPoints: [
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
      statusMessage: `Extension with id ${extensionId} has not configured the "${requestedExtensionPointTarget}" extension point`,
    })
  })

  it('returns a 404 if requested extension point target is invalid and no redirect url can be constructed', async () => {
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
              extensionPoints: [
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
      statusMessage: `Redirect url can't be constructed for extension with id ${extensionId} and extension point "${extensionPointTarget}"`,
    })
  })

  it('returns the redirect URL if the requested extension point target is configured', async () => {
    vi.spyOn(http, 'sendRedirect')
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
              extensionPoints: [
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

    expect(http.sendRedirect).toHaveBeenCalledWith(response.event, 'http://www.mock.com/redirect/url', 307)
  })
})

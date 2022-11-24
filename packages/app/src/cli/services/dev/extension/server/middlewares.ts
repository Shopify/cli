import {getExtensionPointRedirectUrl, getExtensionUrl, getRedirectUrl, sendError} from './utilities.js'
import {GetExtensionsMiddlewareOptions} from './models.js'
import {getUIExtensionPayload} from '../payload.js'
import {getHTML} from '../templates.js'
import {file, http, output, path} from '@shopify/cli-kit'

export function corsMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
  )
  next()
}

export function noCacheMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
) {
  response.setHeader('Cache-Control', 'no-cache')
  next()
}

export async function redirectToDevConsoleMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
) {
  await http.sendRedirect(response.event, '/extensions/dev-console', 307)
}

export async function fileServerMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
  options: {filePath: string},
) {
  let {filePath} = options

  if (await file.isDirectory(filePath)) {
    filePath += filePath.endsWith('/') ? `index.html` : '/index.html'
  }

  const fileExists = await file.exists(filePath)

  if (!fileExists) {
    return sendError(response, {statusCode: 404, statusMessage: `Not Found: ${filePath}`})
  }

  const fileContent = await file.read(filePath)
  const extensionToContent = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
  } as const

  const extensionName = path.extname(filePath) as keyof typeof extensionToContent
  const contentType = extensionToContent[extensionName] || 'text/plain'

  response.setHeader('Content-Type', contentType)
  response.writeHead(200)
  response.end(fileContent)
}

export function getExtensionAssetMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: http.IncomingMessage, response: http.ServerResponse, next: (err?: Error) => unknown) => {
    const {extensionId, assetPath} = request.context.params
    const extension = devOptions.extensions.find((extension) => extension.devUUID === extensionId)

    if (!extension) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionId} not found`,
      })
    }

    const buildDirectory = extension.outputBundlePath.replace('main.js', '')

    return fileServerMiddleware(request, response, next, {
      filePath: path.join(buildDirectory, assetPath),
    })
  }
}

export function getExtensionsPayloadMiddleware({payloadStore}: GetExtensionsMiddlewareOptions) {
  return async (request: http.IncomingMessage, response: http.ServerResponse, next: (err?: Error) => unknown) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payloadStore.getRawPayload()))
  }
}

export async function devConsoleIndexMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
) {
  const rootDirectory = await path.findUp(path.join('assets', 'dev-console'), {
    type: 'directory',
    cwd: path.moduleDirectory(import.meta.url),
  })

  if (!rootDirectory) {
    return sendError(response, {
      statusCode: 404,
      statusMessage: `Could not find root directory for dev console`,
    })
  }

  return fileServerMiddleware(request, response, next, {
    filePath: rootDirectory,
  })
}

export async function devConsoleAssetsMiddleware(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: (err?: Error) => unknown,
) {
  const {assetPath} = request.context.params

  const rootDirectory = await path.findUp(path.join('assets', 'dev-console', 'extensions', 'dev-console', 'assets'), {
    type: 'directory',
    cwd: path.moduleDirectory(import.meta.url),
  })

  if (!rootDirectory) {
    return sendError(response, {
      statusCode: 404,
      statusMessage: `Could not find root directory for dev console asset`,
    })
  }

  return fileServerMiddleware(request, response, next, {
    filePath: path.join(rootDirectory, assetPath),
  })
}

export function getLogMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: http.IncomingMessage, response: http.ServerResponse, next: (err?: Error) => unknown) => {
    output.debug(`UI extensions server received a ${request.method} request to URL ${request.url}`, (message) =>
      devOptions.stdout.write(message, 'utf8'),
    )
    next()
  }
}

export function getExtensionPayloadMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: http.IncomingMessage, response: http.ServerResponse, next: (err?: Error) => unknown) => {
    const extensionID = request.context.params.extensionId
    const extension = devOptions.extensions.find((extension) => extension.devUUID === extensionID)

    if (!extension) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} not found`,
      })
    }

    if (request.headers.accept?.startsWith('text/html')) {
      const extensionSurface = extension.surface

      if (extensionSurface === 'post_purchase') {
        const body = await getHTML({
          data: {
            url: getExtensionUrl(extension, devOptions),
          },
          template: 'index',
          extensionSurface,
        })
        await http.send(response.event, body)
        return
      } else {
        const url = getRedirectUrl(extension, devOptions)
        await http.sendRedirect(response.event, url, 307)
        return
      }
    }

    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        app: {
          apiKey: devOptions.apiKey,
        },
        version: '3',
        root: {
          url: new URL('/extensions', devOptions.url).toString(),
        },
        socket: {
          url: getWebsocketUrl(devOptions),
        },
        devConsole: {
          url: new URL('/extensions/dev-console', devOptions.url).toString(),
        },
        store: devOptions.storeFqdn,
        extension: await getUIExtensionPayload(extension, devOptions),
      }),
    )
  }
}

export function getExtensionPointMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: http.IncomingMessage, response: http.ServerResponse, _next: (err?: Error) => unknown) => {
    const extensionID = request.context.params.extensionId
    const requestedTarget = request.context.params.extensionPointTarget
    const extension = devOptions.extensions.find((extension) => extension.devUUID === extensionID)

    if (!extension) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} not found`,
      })
    }

    if (!extension.hasExtensionPointTarget(requestedTarget)) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} has not configured the "${requestedTarget}" extension point`,
      })
    }

    const url = getExtensionPointRedirectUrl(requestedTarget, extension, devOptions)
    if (!url) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Redirect url can't be constructed for extension with id ${extensionID} and extension point "${requestedTarget}"`,
      })
    }

    await http.sendRedirect(response.event, url, 307)
  }
}

function getWebsocketUrl(devOptions: GetExtensionsMiddlewareOptions['devOptions']) {
  const socket = new URL('/extensions', devOptions.url)
  socket.protocol = 'wss:'

  return socket.toString()
}

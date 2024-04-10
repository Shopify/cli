import {getExtensionPointRedirectUrl, getExtensionUrl, getRedirectUrl, sendError} from './utilities.js'
import {GetExtensionsMiddlewareOptions} from './models.js'
import {getUIExtensionPayload} from '../payload.js'
import {getHTML} from '../templates.js'
import {fileExists, isDirectory, readFile, findPathUp} from '@shopify/cli-kit/node/fs'
import {IncomingMessage, ServerResponse, sendRedirect, send} from 'h3'
import {joinPath, extname, moduleDirectory} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'

export function corsMiddleware(_request: IncomingMessage, response: ServerResponse, next: (err?: Error) => unknown) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
  )
  next()
}

export function noCacheMiddleware(_request: IncomingMessage, response: ServerResponse, next: (err?: Error) => unknown) {
  response.setHeader('Cache-Control', 'no-cache')
  next()
}

export async function redirectToDevConsoleMiddleware(
  _request: IncomingMessage,
  response: ServerResponse,
  _next: (err?: Error) => unknown,
) {
  await sendRedirect(response.event, '/extensions/dev-console', 307)
}

export async function fileServerMiddleware(
  _request: IncomingMessage,
  response: ServerResponse,
  _next: (err?: Error) => unknown,
  options: {filePath: string},
) {
  let {filePath} = options

  if (await isDirectory(filePath)) {
    filePath += filePath.endsWith('/') ? `index.html` : '/index.html'
  }

  const exists = await fileExists(filePath)

  if (!exists) {
    return sendError(response, {statusCode: 404, statusMessage: `Not Found: ${filePath}`})
  }

  const fileContent = await readFile(filePath)
  const extensionToContent = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
  } as const

  const extensionName = extname(filePath) as keyof typeof extensionToContent
  const contentType = extensionToContent[extensionName] || 'text/plain'

  response.setHeader('Content-Type', contentType)
  response.writeHead(200)
  response.end(fileContent)
}

export function getExtensionAssetMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: IncomingMessage, response: ServerResponse, next: (err?: Error) => unknown) => {
    const {extensionId, assetPath} = request.context.params
    const extension = devOptions.extensions.find((extension) => extension.devUUID === extensionId)

    if (!extension) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionId} not found`,
      })
    }

    const buildDirectory = extension.outputPath.replace(`${extension.outputFileName}`, '')

    return fileServerMiddleware(request, response, next, {
      filePath: joinPath(buildDirectory, assetPath),
    })
  }
}

export function getExtensionsPayloadMiddleware({payloadStore}: GetExtensionsMiddlewareOptions) {
  return async (_request: IncomingMessage, response: ServerResponse, _next: (err?: Error) => unknown) => {
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(payloadStore.getRawPayload()))
  }
}

export async function devConsoleIndexMiddleware(
  request: IncomingMessage,
  response: ServerResponse,
  next: (err?: Error) => unknown,
) {
  const rootDirectory = await findPathUp(joinPath('assets', 'dev-console'), {
    type: 'directory',
    cwd: moduleDirectory(import.meta.url),
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
  request: IncomingMessage,
  response: ServerResponse,
  next: (err?: Error) => unknown,
) {
  const {assetPath} = request.context.params

  const rootDirectory = await findPathUp(joinPath('assets', 'dev-console', 'extensions', 'dev-console', 'assets'), {
    type: 'directory',
    cwd: moduleDirectory(import.meta.url),
  })

  if (!rootDirectory) {
    return sendError(response, {
      statusCode: 404,
      statusMessage: `Could not find root directory for dev console asset`,
    })
  }

  return fileServerMiddleware(request, response, next, {
    filePath: joinPath(rootDirectory, assetPath),
  })
}

export function getLogMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: IncomingMessage, _response: ServerResponse, next: (err?: Error) => unknown) => {
    outputDebug(`UI extensions server received a ${request.method} request to URL ${request.url}`, devOptions.stdout)
    next()
  }
}

export function getExtensionPayloadMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return async (request: IncomingMessage, response: ServerResponse, _next: (err?: Error) => unknown) => {
    const extensionID = request.context.params.extensionId
    const extension = devOptions.extensions.find((extension) => extension.devUUID === extensionID)

    if (!extension) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} not found`,
      })
    }

    if (request.headers.accept?.startsWith('text/html')) {
      if (extension.type === 'checkout_post_purchase') {
        const body = await getHTML({
          data: {
            url: getExtensionUrl(extension, devOptions),
          },
          template: 'index',
          extensionSurface: 'post_purchase',
        })
        await send(response.event, body)
        return
      } else {
        const url = getRedirectUrl(extension, devOptions)
        await sendRedirect(response.event, url, 307)
        return
      }
    }

    response.setHeader('content-type', 'application/json')
    response.end(
      JSON.stringify({
        app: {
          apiKey: devOptions.apiKey,
        },
        version: devOptions.manifestVersion,
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
  return async (request: IncomingMessage, response: ServerResponse, _next: (err?: Error) => unknown) => {
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
        statusMessage: `Extension with id ${extensionID} has not configured the "${requestedTarget}" extension target`,
      })
    }

    const url = getExtensionPointRedirectUrl(requestedTarget, extension, devOptions)
    if (!url) {
      return sendError(response, {
        statusCode: 404,
        statusMessage: `Redirect url can't be constructed for extension with id ${extensionID} and extension target "${requestedTarget}"`,
      })
    }

    await sendRedirect(response.event, url, 307)
  }
}

function getWebsocketUrl(devOptions: GetExtensionsMiddlewareOptions['devOptions']) {
  const socket = new URL('/extensions', devOptions.url)
  socket.protocol = 'wss:'

  return socket.toString()
}

import {getExtensionPointRedirectUrl, getExtensionUrl, getRedirectUrl, sendError} from './utilities.js'
import {GetExtensionsMiddlewareOptions} from './models.js'
import {getUIExtensionPayload} from '../payload.js'
import {getHTML} from '../templates.js'
import {getWebSocketUrl} from '../../extension.js'
import {fileExists, isDirectory, readFile, findPathUp} from '@shopify/cli-kit/node/fs'
import {sendRedirect, defineEventHandler, getRequestHeader, getRouterParams, setResponseHeader} from 'h3'
import {joinPath, dirname, extname, moduleDirectory} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'

import type {H3Event} from 'h3'

export const corsMiddleware = defineEventHandler((event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  setResponseHeader(
    event,
    'Access-Control-Allow-Headers',
    'Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning',
  )
})

export const noCacheMiddleware = defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-cache')
})

export const redirectToDevConsoleMiddleware = defineEventHandler(async (event) => {
  return sendRedirect(event, '/extensions/dev-console', 307)
})

export async function fileServerMiddleware(event: H3Event, options: {filePath: string}) {
  let {filePath} = options

  if (await isDirectory(filePath)) {
    filePath += filePath.endsWith('/') ? `index.html` : '/index.html'
  }

  const exists = await fileExists(filePath)

  if (!exists) {
    return sendError(event, {statusCode: 404, statusMessage: `Not Found: ${filePath}`})
  }

  const fileContent = await readFile(filePath)
  const extensionToContent = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
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

  setResponseHeader(event, 'Content-Type', contentType)
  return fileContent
}

export function getExtensionAssetMiddleware({devOptions, getExtensions}: GetExtensionsMiddlewareOptions) {
  return defineEventHandler(async (event) => {
    const {extensionId, assetPath = ''} = getRouterParams(event)
    const extension = getExtensions().find((ext) => ext.devUUID === extensionId)

    if (!extension) {
      return sendError(event, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionId} not found`,
      })
    }

    const bundlePath = devOptions.appWatcher.buildOutputPath
    const extensionOutputPath = extension.getOutputPathForDirectory(bundlePath)

    const buildDirectory = dirname(extensionOutputPath)

    return fileServerMiddleware(event, {
      filePath: joinPath(buildDirectory, assetPath),
    })
  })
}

export function getExtensionsPayloadMiddleware({payloadStore}: GetExtensionsMiddlewareOptions) {
  return defineEventHandler((event) => {
    setResponseHeader(event, 'content-type', 'application/json')
    return payloadStore.getRawPayload()
  })
}

export const devConsoleIndexMiddleware = defineEventHandler(async (event) => {
  const rootDirectory = await findPathUp(joinPath('assets', 'dev-console'), {
    type: 'directory',
    cwd: moduleDirectory(import.meta.url),
  })

  if (!rootDirectory) {
    return sendError(event, {
      statusCode: 404,
      statusMessage: `Could not find root directory for dev console`,
    })
  }

  return fileServerMiddleware(event, {
    filePath: rootDirectory,
  })
})

export const devConsoleAssetsMiddleware = defineEventHandler(async (event) => {
  const {assetPath = ''} = getRouterParams(event)

  const rootDirectory = await findPathUp(joinPath('assets', 'dev-console', 'extensions', 'dev-console', 'assets'), {
    type: 'directory',
    cwd: moduleDirectory(import.meta.url),
  })

  if (!rootDirectory) {
    return sendError(event, {
      statusCode: 404,
      statusMessage: `Could not find root directory for dev console asset`,
    })
  }

  return fileServerMiddleware(event, {
    filePath: joinPath(rootDirectory, assetPath),
  })
})

export function getAppAssetsMiddleware(appAssets: Record<string, string>) {
  return defineEventHandler(async (event) => {
    const {assetKey = '', filePath = ''} = getRouterParams(event)

    const directory = appAssets[assetKey]

    if (!directory) {
      return sendError(event, {statusCode: 404, statusMessage: `No app assets configured for key: ${assetKey}`})
    }

    return fileServerMiddleware(event, {
      filePath: joinPath(directory, filePath),
    })
  })
}

export function getLogMiddleware({devOptions}: GetExtensionsMiddlewareOptions) {
  return defineEventHandler((event) => {
    outputDebug(`UI extensions server received a ${event.method} request to URL ${event.path}`, devOptions.stdout)
  })
}

export function getExtensionPayloadMiddleware({devOptions, getExtensions}: GetExtensionsMiddlewareOptions) {
  return defineEventHandler(async (event) => {
    const {extensionId: extensionID} = getRouterParams(event)
    const extension = getExtensions().find((ext) => ext.devUUID === extensionID)

    if (!extension) {
      return sendError(event, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} not found`,
      })
    }

    const accept = getRequestHeader(event, 'accept')
    if (accept?.startsWith('text/html')) {
      if (extension.type === 'checkout_post_purchase') {
        return getHTML({
          data: {
            url: getExtensionUrl(extension, devOptions),
          },
          template: 'index',
          extensionSurface: 'post_purchase',
        })
      } else {
        const url = getRedirectUrl(extension, devOptions)
        return sendRedirect(event, url, 307)
      }
    }
    const bundlePath = devOptions.appWatcher.buildOutputPath

    setResponseHeader(event, 'content-type', 'application/json')
    return {
      app: {
        apiKey: devOptions.apiKey,
      },
      version: devOptions.manifestVersion,
      root: {
        url: new URL('/extensions', devOptions.url).toString(),
      },
      socket: {
        url: getWebSocketUrl(devOptions.url),
      },
      devConsole: {
        url: new URL('/extensions/dev-console', devOptions.url).toString(),
      },
      store: devOptions.storeFqdn,
      extension: await getUIExtensionPayload(extension, bundlePath, devOptions),
    }
  })
}

export function getExtensionPointMiddleware({devOptions, getExtensions}: GetExtensionsMiddlewareOptions) {
  return defineEventHandler(async (event) => {
    const {extensionId: extensionID, extensionPointTarget: requestedTarget = ''} = getRouterParams(event)
    const extension = getExtensions().find((ext) => ext.devUUID === extensionID)

    if (!extension) {
      return sendError(event, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} not found`,
      })
    }

    if (
      extension.configuration.type !== 'checkout_post_purchase' &&
      !extension.hasExtensionPointTarget(requestedTarget)
    ) {
      return sendError(event, {
        statusCode: 404,
        statusMessage: `Extension with id ${extensionID} has not configured the "${requestedTarget}" extension target`,
      })
    }

    const url = getExtensionPointRedirectUrl(requestedTarget, extension, devOptions)
    if (!url) {
      return sendError(event, {
        statusCode: 404,
        statusMessage: `Redirect url can't be constructed for extension with id ${extensionID} and extension target "${requestedTarget}"`,
      })
    }

    return sendRedirect(event, url, 307)
  })
}

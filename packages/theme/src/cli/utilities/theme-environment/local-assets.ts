import {injectCdnProxy} from './proxy.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, EventHandlerRequest, H3Event, serveStatic, setResponseHeader} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Theme, VirtualFileSystem} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

/**
 * Handles requests for assets to the proxied Shopify CDN, serving local files.
 */
export function getAssetsHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path

    const fileAndFileSystem = getFileAndFileSystem(event, ctx)
    if (!fileAndFileSystem) return

    const {file, fileSystem} = fileAndFileSystem
    const mimeType = lookupMimeType(file.key)

    if (mimeType.startsWith('image/') && event.path.includes('&') && !fileSystem.unsyncedFileKeys.has(file.key)) {
      // This is likely a request for an image with filters (e.g. crop),
      // which we don't support locally. Bypass and get it from the CDN.
      return
    }

    // Add header for debugging that the files come from the local assets
    setResponseHeader(event, 'X-Local-Asset', 'true')

    const fileContent = file.value ? injectCdnProxy(file.value, ctx) : Buffer.from(file.attachment ?? '', 'base64')

    return serveStatic(event, {
      getContents: () => fileContent,
      // Note: stats.size is the length of the base64 string for attachments,
      // not the real length of the file. Use the Buffer length instead:
      getMeta: () => ({type: mimeType, size: fileContent.length, mtime: file.stats?.mtime}),
    })
  })
}

function getFileAndFileSystem(event: H3Event<EventHandlerRequest>, ctx: DevServerContext) {
  const tryGetFile = (pattern: RegExp, fileSystem: VirtualFileSystem) => {
    const matchedFileName = event.path.match(pattern)?.[1]

    if (matchedFileName) {
      const file = fileSystem.files.get(joinPath('assets', matchedFileName))

      if (file) {
        return {file, fileSystem}
      }
    }
  }

  let result

  // Try to match theme asset files
  result = tryGetFile(/^\/cdn\/.*?\/assets\/([^?]+)(\?|$)/, ctx.localThemeFileSystem)
  if (result) {
    return result
  }

  // Try to match theme extension asset files
  result = tryGetFile(/^\/ext\/cdn\/extensions\/.*?\/.*?\/assets\/([^?]+)(\?|$)/, ctx.localThemeExtensionFileSystem)
  if (result) {
    return result
  }

  return result
}

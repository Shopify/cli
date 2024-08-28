import {injectCdnProxy} from './proxy.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, serveStatic, setResponseHeader} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

/**
 * Handles requests for assets to the proxied Shopify CDN, serving local files.
 */
export function getAssetsHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path
    const assetsFilename = event.path.match(/^\/cdn\/.*?\/assets\/([^?]+)(\?|$)/)?.[1]
    const file = assetsFilename ? ctx.localThemeFileSystem.files.get(joinPath('assets', assetsFilename)) : undefined
    if (!file) return

    const mimeType = lookupMimeType(file.key)

    if (
      mimeType.startsWith('image/') &&
      event.path.includes('&') &&
      !ctx.localThemeFileSystem.unsyncedFileKeys.has(file.key)
    ) {
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

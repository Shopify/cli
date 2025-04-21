import {injectCdnProxy} from './proxy.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, H3Event, serveStatic, setResponseHeader, sendError, createError} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Theme, VirtualFileSystem} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

/**
 * Handles requests for assets to the proxied Shopify CDN, serving local files.
 */
export function getAssetsHandler(_theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    if (isCompiledAssetRequest(event)) {
      return handleCompiledAssetRequest(event, ctx)
    }

    // Matches asset filenames in an HTTP Request URL path

    const {file, fileKey, isUnsynced} = findLocalFile(event, ctx)
    if (!fileKey) return

    const mimeType = lookupMimeType(fileKey)

    if (mimeType.startsWith('image/') && event.path.includes('&') && !isUnsynced) {
      // This is likely a request for an image with filters (e.g. crop),
      // which we don't support locally. Bypass and get it from the CDN.
      return
    }

    // Add header for debugging that the files come from the local assets
    setResponseHeader(event, 'X-Local-Asset', 'true')

    if (!file) {
      // If a missing file is unsynced, it means the file has been removed locally.
      // In this case, we return a 404 to the client so they know the file is gone.
      // Otherwise, fallback to the CDN proxy to get the remote version of the file.
      if (isUnsynced) sendError(event, createError({statusCode: 404, statusMessage: 'Not found'}))
      return
    }

    // Normalize the file content to a Buffer:
    // - For attachments, we need to decode the base64 string.
    // - For normal files, we need to get the real length of
    //   the file using Buffer to avoid issues with non-breaking
    //   spaces (NBSP, Unicode U+00A0), which have a different
    //   byte length than their visual representation.
    const fileContent = file.value
      ? Buffer.from(injectCdnProxy(file.value, ctx))
      : Buffer.from(file.attachment ?? '', 'base64')

    return serveStatic(event, {
      getContents: () => fileContent,
      // Note: stats.size is the length of the base64 string for attachments,
      // not the real length of the file. Use the Buffer length instead:
      getMeta: () => ({type: mimeType, size: fileContent.length, mtime: file.stats?.mtime}),
    })
  })
}

function findLocalFile(event: H3Event, ctx: DevServerContext) {
  const tryGetFile = (pattern: RegExp, fileSystem: VirtualFileSystem) => {
    const matchedFileName = event.path.match(pattern)?.[1]

    if (matchedFileName) {
      const fileKey = joinPath('assets', matchedFileName)
      const file = fileSystem.files.get(fileKey)
      const isUnsynced = fileSystem.unsyncedFileKeys.has(fileKey)

      if (file || isUnsynced) {
        return {file, isUnsynced, fileKey}
      }
    }
  }

  // Try to match theme asset files first and fallback to theme extension asset files
  return (
    tryGetFile(/^(?:\/cdn\/.*?)?\/assets\/([^?]+)/, ctx.localThemeFileSystem) ??
    tryGetFile(/^(?:\/ext\/cdn\/extensions\/.*?)?\/assets\/([^?]+)/, ctx.localThemeExtensionFileSystem) ?? {
      isUnsynced: false,
      fileKey: undefined,
      file: undefined,
    }
  )
}

function isCompiledAssetRequest(event: H3Event) {
  return event.path.includes('/compiled_assets')
}

function handleCompiledAssetRequest(event: H3Event, ctx: DevServerContext) {
  const assetPath = new URL(event.path, 'http://e.c').pathname.split('/').at(-1)

  if (assetPath === 'styles.css') {
    const allLiquidFiles = [...ctx.localThemeFileSystem.files.entries()].filter(([key]) => key.endsWith('.liquid'))

    const getLiquidFilesFromDir = (dirPrefix: string) => {
      return allLiquidFiles
        .filter(([key]) => key.startsWith(`${dirPrefix}/`))
        .sort(([key1], [key2]) => key1.localeCompare(key2))
    }

    const sectionFiles = getLiquidFilesFromDir('sections')
    const blockFiles = getLiquidFilesFromDir('blocks')
    const snippetFiles = getLiquidFilesFromDir('snippets')

    let stylesheet = '/* Generated locally */\n'

    for (const [, file] of [...sectionFiles, ...blockFiles, ...snippetFiles]) {
      stylesheet += file.value?.match(/{%\s*stylesheet\s*%}([\s\S]*?){%\s*endstylesheet\s*%}/)?.[1] ?? ''
    }

    return serveStatic(event, {
      getContents: () => stylesheet,
      getMeta: () => ({type: 'text/css', size: stylesheet.length, mtime: new Date()}),
    })
  }
}

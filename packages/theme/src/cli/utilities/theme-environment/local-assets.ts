import {injectCdnProxy} from './proxy.js'
import {parseServerEvent} from './server-utils.js'
import {getLiquidTagContent} from './liquid-tag-content.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, H3Event, serveStatic, setResponseHeader, sendError, createError} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {Theme, ThemeAsset, VirtualFileSystem} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

const tagContentCache = {
  stylesheet: new Map<string, {checksum: string; content: string}>(),
  javascript: new Map<string, {checksum: string; content: string}>(),
}

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

      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
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

function isCompiledAssetRequest(event: H3Event): boolean {
  return event.path.includes('/compiled_assets')
}

function handleCompiledAssetRequest(event: H3Event, ctx: DevServerContext) {
  const pathname = parseServerEvent(event).pathname
  const assetPath = pathname.split('/').at(-1)

  switch (assetPath) {
    case 'styles.css':
      return handleStylesCss(ctx, event)
    case 'block-scripts.js':
      return handleBlockScriptsJs(ctx, event, 'block')
    case 'snippet-scripts.js':
      return handleBlockScriptsJs(ctx, event, 'snippet')
    case 'scripts.js':
      return handleBlockScriptsJs(ctx, event, 'section')
    default:
  }
}

function handleStylesCss(ctx: DevServerContext, event: H3Event) {
  const sectionFiles = getLiquidFilesByKind(ctx, 'section')
  const blockFiles = getLiquidFilesByKind(ctx, 'block')
  const snippetFiles = getLiquidFilesByKind(ctx, 'snippet')

  const stylesheets = ['/*** GENERATED LOCALLY ***/\n']

  for (const [, file] of [...sectionFiles, ...blockFiles, ...snippetFiles]) {
    const stylesheet = getTagContent(file, 'stylesheet')
    if (stylesheet) stylesheets.push(stylesheet)
  }

  const stylesheet = stylesheets.join('\n')

  return serveStatic(event, {
    getContents: () => stylesheet,
    getMeta: () => ({type: 'text/css', size: stylesheet.length, mtime: new Date()}),
  })
}

function handleBlockScriptsJs(ctx: DevServerContext, event: H3Event, kind: 'block' | 'snippet' | 'section') {
  const liquidFiles = getLiquidFilesByKind(ctx, kind)
  const kinds = `${kind}s`

  const javascripts = [
    `
      /*** GENERATED LOCALLY ***/

      (function () {
        var __${kinds}__ = {};

        (function () {
          var element = document.getElementById("${kinds}-script");
          var attribute = element ? element.getAttribute("data-${kinds}") : "";
          var ${kinds} = attribute.split(",").filter(Boolean);

          for (var i = 0; i < ${kinds}.length; i++) {
            __${kinds}__[${kinds}[i]] = true;
          }
        })();`,
  ]

  for (const [key, file] of liquidFiles) {
    const baseName = key.split('/').pop()?.replace('.liquid', '')
    const javascript = getTagContent(file, 'javascript') ?? ''

    if (baseName && javascript) {
      /**
       * For sections, this approach isn't completely accurate, as we'd have
       * something like this:
       * ```
       *    if (!__sections__['header'] && !window.DesignMode) return;
       * ```
       * However, this works well enough for most cases. It's preferable to have
       * a consistent JavaScript workflow across sections, blocks, and snippets,
       * especially when considering hot reloading. This only affects JavaScript
       * sections in the theme editor and doesn't impact the main runtime.
       */
      javascripts.push(`
        (function () {
          if (!__${kinds}__["${baseName}"] && !Shopify.designMode) return;
          try {
            ${javascript}
          } catch (e) {
            console.error(e);
          }
        })();`)
    }
  }

  javascripts.push('})();')

  const javascript = javascripts.join('\n')

  return serveStatic(event, {
    getContents: () => javascript,
    getMeta: () => ({type: 'text/javascript', size: javascript.length, mtime: new Date()}),
  })
}

function getLiquidFilesByKind(ctx: DevServerContext, kind: 'section' | 'block' | 'snippet') {
  return [...ctx.localThemeFileSystem.files.entries()]
    .filter(([key]) => {
      return key.endsWith('.liquid') && key.startsWith(`${kind}s/`)
    })
    .sort(([key1], [key2]) => {
      return key1.localeCompare(key2)
    })
}

function getTagContent(file: ThemeAsset, tag: 'javascript' | 'stylesheet') {
  const cache = tagContentCache[tag]
  const cached = cache.get(file.key)

  if (cached?.checksum === file.checksum) {
    return cached.content
  }

  cache.delete(file.key)

  if (!file.value) {
    return
  }

  const contents = [`/* ${file.key} */`]

  const tagContent = getLiquidTagContent(file.value ?? '', tag)
  if (tagContent) {
    contents.push(tagContent)
  }

  if (contents.length > 1) {
    const content = contents.join('\n')
    cache.set(file.key, {checksum: file.checksum, content})

    return content
  }
}

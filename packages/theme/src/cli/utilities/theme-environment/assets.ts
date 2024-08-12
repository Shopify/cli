import {readFile} from '@shopify/cli-kit/node/fs'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, serveStatic} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import {stat} from 'fs/promises'
import type {ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

/** Forces assets to be served from local domain */
export function replaceLocalAssets(originalHtml: string, themeFileSystem: ThemeFileSystem) {
  let html = originalHtml
  const existingAssets = [...themeFileSystem.files.keys()].filter((key) => key.startsWith('assets'))

  for (const [, matchedUrl] of html.matchAll(/<(?:link|script)\s?[^>]*\s(?:href|src)="([^"]+)"/g)) {
    if (!matchedUrl) continue

    const matchedAsset = existingAssets.find((asset) => matchedUrl.includes(asset))

    if (matchedAsset) {
      const querystring = matchedUrl.split('?')[1] ?? ''
      html = html.replaceAll(matchedUrl, `/${matchedAsset}${querystring ? `?${querystring}` : ''}`)
    }
  }

  return html
}

export function getAssetsHandler(rootDir: string) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path
    const assetsFilename = event.path.match(/^\/assets\/(.+)$/)?.[1]

    if (assetsFilename) {
      const filepath = joinPath(rootDir, 'assets', assetsFilename)

      return serveStatic(event, {
        getContents: () => readFile(filepath),
        getMeta: async () => {
          const stats = await stat(filepath).catch(() => {})

          if (stats?.isFile()) {
            return {
              size: stats.size,
              mtime: stats.mtimeMs,
              type: lookupMimeType(filepath),
            }
          }
        },
      })
    }
  })
}

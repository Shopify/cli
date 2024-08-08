import {readFile} from '@shopify/cli-kit/node/fs'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, serveStatic} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import {stat} from 'fs/promises'

/** Forces assets to be served from local domain */
export function replaceLocalAssets(html: string) {
  // Matches assets domain in HTML link/script tags
  return html.replace(
    /<(?:link|script)\s?[^>]*\s(?:href|src)="(\/\/[^.]+\.myshopify\.com)\/cdn\/shop\/t\/\d+\/assets\//g,
    (all, m1) => all.replaceAll(m1, ''),
  )
}

export function getAssetsHandler(rootDir: string) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path
    const assetsFilename = event.path.match(/^\/cdn\/shop\/t\/\d+\/assets\/(.+)$/)?.[1]

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

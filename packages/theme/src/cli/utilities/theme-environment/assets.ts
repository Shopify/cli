import {readFile} from '@shopify/cli-kit/node/fs'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {H3Event, serveStatic} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import {stat} from 'fs/promises'

const ASSETS_RE = /^\/cdn\/shop\/t\/\d+\/assets\/(.+)$/

export function isAssetsRequest(event: H3Event) {
  return ASSETS_RE.test(event.path)
}

export function replaceLocalAssets(html: string) {
  return html.replace(
    /<(?:link|script)\s?[^>]*\s(?:href|src)="(\/\/[^.]+\.myshopify\.com)\/cdn\/shop\/t\/\d+\/assets\//g,
    (all, m1) => all.replaceAll(m1, ''),
  )
}

export async function serveLocalAsset(event: H3Event, rootDir: string) {
  const filename = event.path.match(ASSETS_RE)?.[1]
  if (!filename) return

  const filepath = joinPath(rootDir, 'assets', filename)

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

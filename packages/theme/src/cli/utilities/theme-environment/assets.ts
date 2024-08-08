import {readFile} from '@shopify/cli-kit/node/fs'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {H3Event, serveStatic} from 'h3'
import {stat} from 'fs/promises'

export function replaceLocalAssets(html: string) {
  return html.replace(
    /<(?:link|script)\s?[^>]*\s(?:href|src)="(\/\/[^.]+\.myshopify\.com)\/cdn\/shop\/t\/\d+\/assets\//g,
    (all, m1) => all.replaceAll(m1, ''),
  )
}

export async function serveLocalAsset(event: H3Event, filepath: string) {
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

import {replaceCdnProxy} from './proxy.js'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {defineEventHandler, serveStatic} from 'h3'
import {joinPath} from '@shopify/cli-kit/node/path'
import {stat} from 'fs/promises'
import type {DevServerContext} from './types.js'

export function getAssetsHandler(ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') return

    // Matches asset filenames in an HTTP Request URL path
    const assetsFilename = event.path.match(/^\/cdn\/.*?\/assets\/([^?]+)(\?|$)/)?.[1]
    const fileKey = assetsFilename && joinPath('assets', assetsFilename)

    if (fileKey && ctx.localThemeFileSystem.files.has(fileKey)) {
      return serveStatic(event, {
        getContents: () => {
          // NOTE: Use cached value when localThemeFileSystem watches files
          // const cachedValue = ctx.localThemeFileSystem.files.get(fileKey)?.value
          // if (cachedValue) return replaceCdnProxy(cachedValue, ctx)

          return ctx.localThemeFileSystem.read(fileKey).then((content) => replaceCdnProxy(content as string, ctx))
        },
        getMeta: async () => {
          const stats = await stat(joinPath(ctx.directory, fileKey)).catch(() => {})

          if (stats?.isFile()) {
            return {
              size: stats.size,
              mtime: stats.mtimeMs,
              type: lookupMimeType(fileKey),
            }
          }
        },
      })
    }
  })
}

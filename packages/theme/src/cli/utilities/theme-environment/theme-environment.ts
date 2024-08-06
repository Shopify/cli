import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {uploadTheme} from '../theme-uploader.js'
import {createApp, defineEventHandler} from 'h3'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {lookupMimeType} from '@shopify/cli-kit/node/mimes'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {createServer} from 'node:http'

const updatedTemplates = {} as {[key: string]: string}

export async function setupDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)
  await watchTemplates(ctx)
  await startDevelopmentServer(theme, ctx)

  onReady()
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  if (ctx.options.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {
      noDelete: ctx.options.noDelete,
      ignore: ctx.options.ignore,
      only: ctx.options.only,
    })
  }

  await uploadTheme(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {
    nodelete: ctx.options.noDelete,
    ignore: ctx.options.ignore,
    only: ctx.options.only,
  })
}

function startDevelopmentServer(theme: Theme, ctx: DevServerContext) {
  const app = createApp()

  app.use(
    defineEventHandler(async (event) => {
      const {req, res} = event
      if (!req.url || req.method !== 'GET') {
        // Mock the well-known route to avoid 404s
        return req.url?.startsWith('/.well-known') ? '' : undefined
      }

      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.url}`)

      if (/^\/cdn\/shop\/t\/\d+\/assets\/.+$/.test(req.url)) {
        const filePath = joinPath(ctx.directory, req.url.replace(/^\/cdn\/shop\/t\/\d+\//, ''))
        if (!(await fileExists(filePath))) {
          return undefined
        }

        res.setHeader('Content-Type', lookupMimeType(filePath))
        return readFile(filePath)
      }

      const reqForwardHeaders = Object.entries(req.headers).reduce((acc, [key, value]) => {
        if (value && key !== 'host') acc[key] = Array.isArray(value) ? value.join(';') : value
        return acc
      }, {} as {[key: string]: string})

      const response = await render(ctx.session, {
        path: req.url,
        query: [],
        themeId: theme.id.toString(),
        cookies: req.headers.cookie || '',
        sectionId: '',
        headers: reqForwardHeaders,
        replaceTemplates: updatedTemplates,
      })

      res.statusCode = response.status
      res.statusMessage = response.statusText
      for (const [key, value] of Object.entries(response.headers.raw())) {
        // headers.getSetCookie is not defined, use headers.raw
        if (key !== 'content-encoding') {
          res.setHeader(key, value)
        }
      }

      let body = await response.text()
      if (response.headers.get('content-type')?.startsWith('text/html')) {
        // Replace
        body = body.replace(
          /<(?:link|script)\s?[^>]*\s(?:href|src)="(\/\/[^.]+\.myshopify\.com)\/cdn\/shop\/t\/\d+\/assets\//g,
          (all, m1) => all.replaceAll(m1, ''),
        )
      }

      return body
    }),
  )

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return new Promise((resolve) => createServer(app).listen(ctx.options.port, () => resolve(undefined)))
}

async function watchTemplates(ctx: DevServerContext) {
  // Note: check ctx.localThemeFileSystem ?
  const {default: chokidar} = await import('chokidar')

  const watcher = chokidar.watch([ctx.directory], {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/assets/**',
      '**/*.test.*',
      '**/dist/**',
      '**/*.swp',
      '.gitignore',
    ],
    persistent: true,
    ignoreInitial: true,
  })

  watcher.on('all', (event, filePath) => {
    const key = relativePath(ctx.directory, filePath)

    if (event === 'change' || event === 'add') {
      readFile(filePath)
        .then((content) => {
          updatedTemplates[key] = content
        })
        .catch(() => {
          renderWarning({headline: `Failed to read file ${filePath}`})
        })
    } else if (event === 'unlink') {
      delete updatedTemplates[key]
    }
  })
}

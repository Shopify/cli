import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {hmrSection, injectFastRefreshScript} from './hmr.js'
import {replaceLocalAssets, serveLocalAsset} from './assets.js'
import {uploadTheme} from '../theme-uploader.js'
import {
  createApp,
  defineEventHandler,
  toNodeListener,
  setResponseHeaders,
  setResponseStatus,
  removeResponseHeader,
  sendProxy,
  getProxyRequestHeaders,
} from 'h3'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {createServer} from 'node:http'

const updatedTemplates = {} as {[key: string]: string}

export async function setupDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)
  await watchTemplates(theme, ctx)
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
      const {path: urlPath, method, headers} = event

      if (method !== 'GET') {
        // Mock the well-known route to avoid errors
        return null
      }

      // -- Handle local assets --
      const assetFilename = event.path.match(/^\/cdn\/shop\/t\/\d+\/assets\/(.+)$/)?.[1]
      if (assetFilename) {
        return serveLocalAsset(event, joinPath(ctx.directory, 'assets', assetFilename))
      }

      const isHtmlRequest = event.headers.get('accept')?.includes('text/html')

      if (!isHtmlRequest || urlPath.startsWith('/wpm')) {
        console.log('proxyRequest', `https://${ctx.session.storeFqdn}${event.path}`)
        return sendProxy(event, `https://${ctx.session.storeFqdn}${event.path}`)
      }

      // eslint-disable-next-line no-console
      console.log(`${method} ${urlPath}`)

      const response = await render(ctx.session, {
        path: urlPath,
        query: [],
        themeId: String(theme.id),
        cookies: headers.get('cookie') || '',
        sectionId: '',
        headers: getProxyRequestHeaders(event),
        replaceTemplates: updatedTemplates,
      })

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))

      // We are decoding the payload here, remove the header:
      const html = await response.text()
      removeResponseHeader(event, 'content-encoding')

      return injectFastRefreshScript(replaceLocalAssets(html))
    }),
  )

  return new Promise((resolve) => createServer(toNodeListener(app)).listen(ctx.options.port, () => resolve(undefined)))
}

async function watchTemplates(theme: Theme, ctx: DevServerContext) {
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

    if (event === 'unlink') {
      delete updatedTemplates[key]
    } else if (event === 'change' || event === 'add') {
      readFile(filePath)
        .then((content) => {
          updatedTemplates[key] = content
        })
        .catch((error) => {
          renderWarning({headline: `Failed to read file ${filePath}: ${error.message}`})
        })
        .then(() => {
          if (key.startsWith('sections/')) {
            return hmrSection(theme, ctx, key)
          }
        })
        .catch((error) => {
          renderWarning({
            headline: `Failed to fast refresh section ${key}: ${error.message}\nPlease reload the page.`,
          })
        })
    }
  })
}

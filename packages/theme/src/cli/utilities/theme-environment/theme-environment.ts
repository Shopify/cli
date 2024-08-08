import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {hmrSection, injectFastRefreshScript} from './hmr.js'
import {getAssetsHandler, replaceLocalAssets} from './assets.js'
import {uploadTheme} from '../theme-uploader.js'
import {THEME_DEFAULT_IGNORE_PATTERNS, THEME_DIRECTORY_PATTERNS} from '../theme-fs.js'
import {
  createApp,
  defineEventHandler,
  toNodeListener,
  setResponseHeaders,
  setResponseStatus,
  removeResponseHeader,
  getProxyRequestHeaders,
  proxyRequest,
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

  app.use(getAssetsHandler(ctx.directory))

  app.use(
    defineEventHandler(async (event) => {
      const {path: urlPath, method, headers} = event

      if (method !== 'GET') {
        // Mock the well-known route to avoid errors
        return null
      }

      // -- Handle proxying routes --
      const isHtmlRequest = event.headers.get('accept')?.includes('text/html')
      if (!isHtmlRequest || urlPath.startsWith('/wpm')) {
        return proxyRequest(event, `https://${ctx.session.storeFqdn}${event.path}`)
      }

      // -- Handle HTML rendering requests --

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

  const directoriesToWatch = new Set(
    THEME_DIRECTORY_PATTERNS.filter((pattern) => !pattern.includes('assets')).map((pattern) =>
      joinPath(ctx.directory, pattern.split('/').shift() ?? ''),
    ),
  )

  const watcher = chokidar.watch([...directoriesToWatch], {
    ignored: [...THEME_DEFAULT_IGNORE_PATTERNS, '**/assets/**'],
    persistent: true,
    ignoreInitial: true,
  })

  const getKey = (filePath: string) => relativePath(ctx.directory, filePath)

  const updateMemoryTemplate = (filePath: string) => {
    if (!filePath.endsWith('.liquid') || !filePath.endsWith('.json')) return

    const key = getKey(filePath)

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

  watcher.on('add', updateMemoryTemplate)
  watcher.on('change', updateMemoryTemplate)
  watcher.on('unlink', (filePath) => {
    delete updatedTemplates[getKey(filePath)]
  })
}

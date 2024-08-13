import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {
  getReplaceTemplates,
  triggerHotReload,
  injectHotReloadScript,
  getHotReloadHandler,
  setReplaceTemplate,
  deleteReplaceTemplate,
} from './hot-reload.js'
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
import {joinPath, relativePath, extname} from '@shopify/cli-kit/node/path'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {createServer} from 'node:http'

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

  app.use(getHotReloadHandler(theme, ctx))
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
        replaceTemplates: getReplaceTemplates(),
      })

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))

      // We are decoding the payload here, remove the header:
      const html = await response.text()
      removeResponseHeader(event, 'content-encoding')

      return injectHotReloadScript(replaceLocalAssets(html, ctx.localThemeFileSystem))
    }),
  )

  return new Promise((resolve) => createServer(toNodeListener(app)).listen(ctx.options.port, () => resolve(undefined)))
}

async function watchTemplates(ctx: DevServerContext) {
  const {default: chokidar} = await import('chokidar')

  const directoriesToWatch = new Set(
    THEME_DIRECTORY_PATTERNS.filter((pattern) => !pattern.includes('assets')).map((pattern) =>
      joinPath(ctx.directory, pattern.split('/').shift() ?? ''),
    ),
  )

  let initialized = false
  const getKey = (filePath: string) => relativePath(ctx.directory, filePath)

  chokidar
    .watch([...directoriesToWatch], {
      ignored: [...THEME_DEFAULT_IGNORE_PATTERNS, '**/assets/**'],
      persistent: true,
      ignoreInitial: false,
    })
    .on('ready', () => (initialized = true))
    .on('add', updateMemoryTemplate)
    .on('change', updateMemoryTemplate)
    .on('unlink', (filePath) => deleteReplaceTemplate(getKey(filePath)))

  function updateMemoryTemplate(filePath: string) {
    const extension = extname(filePath)
    // console.debug('lala', filePath, Boolean(extension), {extension})
    if (!['.liquid', '.json'].includes(extension)) return

    // During initialization we only want to process
    // JSON files to cache their contents early
    if (!initialized && extension !== '.json') return

    const key = getKey(filePath)

    readFile(filePath)
      .then((content) => setReplaceTemplate(key, content))
      .catch((error) => renderWarning({headline: `Failed to read file ${filePath}: ${error.message}`}))
      .then(() => triggerHotReload(key))
      .catch((error) =>
        renderWarning({headline: `Failed to fast refresh ${key}: ${error.message}\nPlease reload the page.`}),
      )
  }
}

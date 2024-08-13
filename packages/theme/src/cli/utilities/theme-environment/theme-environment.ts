import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {setupTemplateWatcher, injectHotReloadScript, getHotReloadHandler} from './hot-reload.js'
import {getAssetsHandler, replaceLocalAssets} from './assets.js'
import {uploadTheme} from '../theme-uploader.js'
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
import {createServer} from 'node:http'

export async function setupDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)
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

async function startDevelopmentServer(theme: Theme, ctx: DevServerContext) {
  const app = createApp()

  const {getInMemoryTemplates} = await setupTemplateWatcher(ctx)

  if (ctx.options.liveReload !== 'off') {
    app.use(getHotReloadHandler(theme, ctx))
  }

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
        replaceTemplates: getInMemoryTemplates(),
      })

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))

      // We are decoding the payload here, remove the header:
      let html = await response.text()
      removeResponseHeader(event, 'content-encoding')

      html = replaceLocalAssets(html, ctx.localThemeFileSystem)

      if (ctx.options.liveReload !== 'off') {
        html = injectHotReloadScript(html)
      }

      return html
    }),
  )

  return new Promise((resolve) => createServer(toNodeListener(app)).listen(ctx.options.port, () => resolve(undefined)))
}

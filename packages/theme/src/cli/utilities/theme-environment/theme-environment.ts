import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {render} from './storefront-renderer.js'
import {setupTemplateWatcher, injectHotReloadScript, getHotReloadHandler} from './hot-reload/server.js'
import {getAssetsHandler, replaceLocalAssets} from './assets.js'
import {getProxyHandler, replaceCdnProxy} from './proxy.js'
import {uploadTheme} from '../theme-uploader.js'
import {
  createApp,
  defineEventHandler,
  toNodeListener,
  setResponseHeaders,
  setResponseStatus,
  removeResponseHeader,
  getProxyRequestHeaders,
} from 'h3'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderError} from '@shopify/cli-kit/node/ui'
import {createServer} from 'node:http'

export async function setupDevServer(theme: Theme, ctx: DevServerContext) {
  await ensureThemeEnvironmentSetup(theme, ctx)
  return startDevelopmentServer(theme, ctx)
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

async function startDevelopmentServer(theme: Theme, ctx: DevServerContext): Promise<{close: () => Promise<void>}> {
  const app = createApp()

  const {getInMemoryTemplates, stopWatcher} = await setupTemplateWatcher(ctx)

  if (ctx.options.liveReload !== 'off') {
    app.use(getHotReloadHandler(theme, ctx))
  }

  app.use(getAssetsHandler(ctx))
  app.use(getProxyHandler(ctx))

  app.use(
    // -- Handle HTML rendering requests --
    defineEventHandler(async (event) => {
      const {path: urlPath, method, headers} = event

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
      }).catch(async (error: Error) => {
        const headline = 'Failed to render storefront.'
        renderError({headline, body: error.stack ?? error.message})
        await event.respondWith(
          new Response(
            getErrorPage({
              title: headline,
              header: headline,
              message: error.message,
              code: error.stack?.replace(`${error.message}\n`, '') ?? '',
            }),
            {status: 502, headers: {'content-type': 'text/html'}},
          ),
        )
      })

      if (!response) return

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))

      // We are decoding the payload here, remove the header:
      let html = await response.text()
      removeResponseHeader(event, 'content-encoding')

      html = replaceLocalAssets(html, ctx)
      html = replaceCdnProxy(html, ctx)

      if (ctx.options.liveReload !== 'off') {
        html = injectHotReloadScript(html)
      }

      return html
    }),
  )

  const server = createServer(toNodeListener(app))

  return new Promise((resolve) =>
    server.listen({port: ctx.options.port, host: ctx.options.host}, () =>
      resolve({
        close: async () => {
          await Promise.all([
            stopWatcher(),
            new Promise((resolve) => {
              server.closeAllConnections()
              server.close(resolve)
            }),
          ])
        },
      }),
    ),
  )
}

export function getErrorPage(options: {title: string; header: string; message: string; code: string}) {
  const html = String.raw

  return html`<html>
    <head>
      <title>${options.title ?? 'Unknown error'}</title>
    </head>
    <body style="display: flex; flex-direction: column; align-items: center; padding-top: 20px; font-family: Arial">
      <h2>${options.header}</h2>
      <p>${options.message}</p>
      <pre>${options.code}</pre>
    </body>
  </html>`
}

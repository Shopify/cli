import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {uploadTheme} from '../theme-uploader.js'
import {createApp, toNodeListener} from 'h3'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {createServer} from 'node:http'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export async function setupDevServer(theme: Theme, ctx: DevServerContext) {
  const [{renderThemeSyncProgress}] = await Promise.all([
    ensureThemeEnvironmentSetup(theme, ctx),
    setupInMemoryTemplateWatcher(ctx),
  ])

  return {
    renderThemeSyncProgress,
    server: createDevelopmentServer(theme, ctx),
  }
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  const remoteChecksums = await fetchChecksums(theme.id, ctx.session)

  if (ctx.options.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
      noDelete: ctx.options.noDelete,
      ignore: ctx.options.ignore,
      only: ctx.options.only,
    })
  }

  return uploadTheme(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
    nodelete: ctx.options.noDelete,
    ignore: ctx.options.ignore,
    only: ctx.options.only,
  })
}

interface DevelopmentServerInstance {
  close: () => Promise<void>
}

function createDevelopmentServer(theme: Theme, ctx: DevServerContext) {
  const app = createApp()

  if (ctx.options.liveReload !== 'off') {
    app.use(getHotReloadHandler(theme, ctx))
  }

  app.use(getAssetsHandler(theme, ctx))
  app.use(getProxyHandler(theme, ctx))
  app.use(getHtmlHandler(theme, ctx))

  const server = createServer(toNodeListener(app))

  return {
    dispatch: app.handler.bind(app),
    start: async (): Promise<DevelopmentServerInstance> => {
      return new Promise((resolve) =>
        server.listen({port: ctx.options.port, host: ctx.options.host}, () =>
          resolve({
            close: async () => {
              await Promise.all([
                new Promise((resolve) => {
                  server.closeAllConnections()
                  server.close(resolve)
                }),
              ])
            },
          }),
        ),
      )
    },
  }
}

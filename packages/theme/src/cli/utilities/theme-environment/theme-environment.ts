import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {uploadTheme} from '../theme-uploader.js'
import {createApp, defineEventHandler, defineLazyEventHandler, toNodeListener} from 'h3'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {createServer} from 'node:http'
import type {Checksum, Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function setupDevServer(theme: Theme, ctx: DevServerContext) {
  const watcherPromise = setupInMemoryTemplateWatcher(theme, ctx)
  const envSetup = ensureThemeEnvironmentSetup(theme, ctx)
  const workPromise = Promise.all([watcherPromise, envSetup.workPromise]).then(() => {})
  const server = createDevelopmentServer(theme, ctx, workPromise)

  return {
    workPromise,
    serverStart: server.start,
    dispatchEvent: server.dispatch,
    renderDevSetupProgress: envSetup.renderProgress,
  }
}

function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  const remoteChecksumsPromise = fetchChecksums(theme.id, ctx.session)

  const reconcilePromise = remoteChecksumsPromise.then((remoteChecksums) =>
    ctx.options.themeEditorSync
      ? ctx.localThemeFileSystem.ready().then(() =>
          reconcileAndPollThemeEditorChanges(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
            noDelete: ctx.options.noDelete,
            ignore: ctx.options.ignore,
            only: ctx.options.only,
          }),
        )
      : remoteChecksums,
  )

  const uploadPromise = reconcilePromise.then(async (remoteChecksums: Checksum[]) =>
    uploadTheme(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
      nodelete: ctx.options.noDelete,
      deferPartialWork: true,
    }),
  )

  return {
    workPromise: uploadPromise.then((result) => result.workPromise),
    renderProgress: async () => {
      const {renderThemeSyncProgress} = await uploadPromise

      await renderThemeSyncProgress()
    },
  }
}

interface DevelopmentServerInstance {
  close: () => Promise<void>
}

function createDevelopmentServer(theme: Theme, ctx: DevServerContext, initialWork: Promise<void>) {
  const app = createApp()

  app.use(
    defineLazyEventHandler(async () => {
      await initialWork
      return defineEventHandler(() => {})
    }),
  )

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

import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {uploadTheme} from '../theme-uploader.js'
import {renderTasksToStdErr} from '../theme-ui.js'
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

  const editorSyncPromise = remoteChecksumsPromise.then((remoteChecksums) =>
    handleThemeEditorSync(theme, ctx, remoteChecksums),
  )

  const themeSetupPromise = editorSyncPromise.then(
    ({updatedRemoteChecksums, reconciliationFinishedPromise, readyForReconciliationPromise}) => {
      const uploadPromise = reconciliationFinishedPromise.then(() =>
        uploadTheme(theme, ctx.session, updatedRemoteChecksums, ctx.localThemeFileSystem, {
          nodelete: ctx.options.noDelete,
          ignore: ctx.options.ignore,
          only: ctx.options.only,
          deferPartialWork: true,
        }),
      )

      return {uploadPromise, reconciliationFinishedPromise, readyForReconciliationPromise}
    },
  )

  return {
    workPromise: themeSetupPromise.then(async ({uploadPromise}) => (await uploadPromise).workPromise),
    renderProgress: async () => {
      if (ctx.options.themeEditorSync) {
        await themeSetupPromise.then(({readyForReconciliationPromise}) => readyForReconciliationPromise)
        await renderTasksToStdErr([
          {
            title: 'Performing file synchronization. This may take a while...',
            task: async () => {
              await themeSetupPromise.then(async ({reconciliationFinishedPromise}) => {
                await reconciliationFinishedPromise
              })
            },
          },
        ])
      }

      const {renderThemeSyncProgress} = await themeSetupPromise.then(({uploadPromise}) => uploadPromise)

      await renderThemeSyncProgress()
    },
  }
}

function handleThemeEditorSync(
  theme: Theme,
  ctx: DevServerContext,
  remoteChecksums: Checksum[],
): Promise<{
  updatedRemoteChecksums: Checksum[]
  reconciliationFinishedPromise: Promise<void>
  readyForReconciliationPromise: Promise<void>
}> {
  if (ctx.options.themeEditorSync) {
    return reconcileAndPollThemeEditorChanges(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
      noDelete: ctx.options.noDelete,
      ignore: ctx.options.ignore,
      only: ctx.options.only,
    })
  } else {
    return Promise.resolve({
      updatedRemoteChecksums: remoteChecksums,
      reconciliationFinishedPromise: Promise.resolve(),
      readyForReconciliationPromise: Promise.resolve(),
    })
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

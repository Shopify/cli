import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {getStorefrontSessionCookies} from './storefront-session.js'
import {buildBaseStorefrontUrl} from './storefront-renderer.js'
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

  const session = ctx.session
  const sessionCookiePromise = envSetup.workPromise.then(async () => {
    // Populate _shopify_essential cookie after the theme is uploaded.
    // This is needed for SFR to be able to render something.
    session.sessionCookies = await getStorefrontSessionCookies(
      buildBaseStorefrontUrl(ctx.session),
      String(theme.id),
      ctx.session.storefrontPassword,
      {},
    )
  })

  const workPromise = Promise.all([watcherPromise, sessionCookiePromise]).then(() => {})

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
    handleThemeEditorSync(theme, ctx, remoteChecksums),
  )

  const uploadPromise = reconcilePromise.then(async ({updatedRemoteChecksumsPromise}) => {
    const updatedRemoteChecksums = await updatedRemoteChecksumsPromise
    return uploadTheme(theme, ctx.session, updatedRemoteChecksums, ctx.localThemeFileSystem, {
      nodelete: ctx.options.noDelete,
      deferPartialWork: true,
    })
  })

  return {
    workPromise: uploadPromise.then((result) => result.workPromise),
    renderProgress: async () => {
      if (ctx.options.themeEditorSync) {
        const {workPromise} = await reconcilePromise
        await renderTasksToStdErr([
          {
            title: 'Performing file synchronization. This may take a while...',
            task: async () => {
              await workPromise
            },
          },
        ])
      }

      const {renderThemeSyncProgress} = await uploadPromise

      await renderThemeSyncProgress()
    },
  }
}

function handleThemeEditorSync(
  theme: Theme,
  ctx: DevServerContext,
  remoteChecksums: Checksum[],
): Promise<{
  updatedRemoteChecksumsPromise: Promise<Checksum[]>
  workPromise: Promise<void>
}> {
  if (ctx.options.themeEditorSync) {
    return reconcileAndPollThemeEditorChanges(theme, ctx.session, remoteChecksums, ctx.localThemeFileSystem, {
      noDelete: ctx.options.noDelete,
      ignore: ctx.options.ignore,
      only: ctx.options.only,
    })
  } else {
    return Promise.resolve({
      updatedRemoteChecksumsPromise: Promise.resolve(remoteChecksums),
      workPromise: Promise.resolve(),
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

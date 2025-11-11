import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {uploadTheme} from '../theme-uploader.js'
import {renderTasksToStdErr} from '../theme-ui.js'
import {createAbortCatchError} from '../errors.js'
import {createApp, defineEventHandler, defineLazyEventHandler, toNodeListener, handleCors} from 'h3'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {createServer} from 'node:http'
import type {Checksum, Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function setupDevServer(theme: Theme, ctx: DevServerContext) {
  const watcherPromise = setupInMemoryTemplateWatcher(theme, ctx)
  const envSetup = ensureThemeEnvironmentSetup(theme, ctx)
  const workPromise = Promise.all([watcherPromise, envSetup.workPromise]).then(() =>
    ctx.localThemeFileSystem.startWatcher(theme.id.toString(), ctx.session),
  )
  const server = createDevelopmentServer(theme, ctx, workPromise)

  return {
    workPromise,
    serverStart: server.start,
    dispatchEvent: server.dispatch,
    renderDevSetupProgress: envSetup.renderProgress,
  }
}

function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  const abort = createAbortCatchError('Failed to perform the initial theme synchronization.')

  const remoteChecksumsPromise = fetchChecksums(theme.id, ctx.session).catch(abort)

  const reconcilePromise = remoteChecksumsPromise
    .then((remoteChecksums) => handleThemeEditorSync(theme, ctx, remoteChecksums))
    .catch(abort)

  const uploadPromise = reconcilePromise
    .then(async ({updatedRemoteChecksumsPromise}) => {
      const updatedRemoteChecksums = await updatedRemoteChecksumsPromise
      return uploadTheme(theme, ctx.session, updatedRemoteChecksums, ctx.localThemeFileSystem, {
        nodelete: ctx.options.noDelete,
        deferPartialWork: true,
        backgroundWorkCatch: abort,
      })
    })
    .catch(abort)

  return {
    workPromise: uploadPromise.then((result) => result.workPromise).catch(abort),
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
  const allowedOrigins = [`http://${ctx.options.host}:${ctx.options.port}`, `https://${ctx.session.storeFqdn}`]

  app.use(
    defineLazyEventHandler(async () => {
      await initialWork
      return defineEventHandler((event) => {
        const origin = event.node.req.headers.origin

        // We only set CORS headers if an Origin header is present in the request.
        // This prevents wildcard CORS on direct navigation.
        if (origin) {
          handleCors(event, {
            origin: (requestOrigin) => allowedOrigins.includes(requestOrigin),
            credentials: true,
            methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
            preflight: {statusCode: 204},
          })
        }
      })
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

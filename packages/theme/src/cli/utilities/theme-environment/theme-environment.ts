import {getHotReloadHandler, setupInMemoryTemplateWatcher} from './hot-reload/server.js'
import {getHtmlHandler} from './html.js'
import {getAssetsHandler} from './local-assets.js'
import {getProxyHandler} from './proxy.js'
import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {uploadTheme} from '../theme-uploader.js'
import {renderTasksToStdErr} from '../theme-ui.js'
import {renderThrownError} from '../errors.js'
import {createApp, defineEventHandler, defineLazyEventHandler, toNodeListener, handleCors} from 'h3'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {createServer} from 'node:http'
import type {Checksum, Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

// Polyfill for Promise.withResolvers
// Can remove once our minimum supported Node version is 22
interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

function promiseWithResolvers<T>(): PromiseWithResolvers<T> {
  if (typeof Promise.withResolvers === 'function') {
    return Promise.withResolvers<T>()
  }

  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return {promise, resolve, reject}
}

export function setupDevServer(theme: Theme, ctx: DevServerContext) {
  const {promise: backgroundJobPromise, reject: rejectBackgroundJob} = promiseWithResolvers<never>()

  const watcherPromise = setupInMemoryTemplateWatcher(theme, ctx)
  const envSetup = ensureThemeEnvironmentSetup(theme, ctx, rejectBackgroundJob)
  const workPromise = Promise.all([watcherPromise, envSetup.workPromise]).then(() =>
    ctx.localThemeFileSystem.startWatcher(theme.id.toString(), ctx.session),
  )
  const server = createDevelopmentServer(theme, ctx, workPromise)

  return {
    workPromise,
    serverStart: server.start,
    dispatchEvent: server.dispatch,
    renderDevSetupProgress: envSetup.renderProgress,
    backgroundJobPromise,
  }
}

function ensureThemeEnvironmentSetup(
  theme: Theme,
  ctx: DevServerContext,
  rejectBackgroundJob: (reason?: unknown) => void,
) {
  const abort = (error: Error): never => {
    renderThrownError('Failed to perform the initial theme synchronization.', error)
    rejectBackgroundJob(error)
    // Return a never-resolving promise to stop this promise chain without throwing.
    // Throwing would trigger catch handlers and continue execution. This stops the
    // chain while the error is handled through the separate backgroundJobPromise channel.
    return new Promise<never>(() => {}) as never
  }

  const remoteChecksumsPromise = fetchChecksums(theme.id, ctx.session)

  const reconcilePromise = remoteChecksumsPromise.then((remoteChecksums) =>
    handleThemeEditorSync(theme, ctx, remoteChecksums, rejectBackgroundJob),
  )

  const uploadPromise = reconcilePromise.then(async ({updatedRemoteChecksumsPromise}) => {
    const updatedRemoteChecksums = await updatedRemoteChecksumsPromise
    return uploadTheme(theme, ctx.session, updatedRemoteChecksums, ctx.localThemeFileSystem, {
      nodelete: ctx.options.noDelete,
      deferPartialWork: true,
      backgroundWorkCatch: abort,
    })
  })

  const workPromise = uploadPromise.then((result) => result.workPromise).catch(abort)

  return {
    workPromise,
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
  rejectBackgroundJob: (reason?: unknown) => void,
): Promise<{
  updatedRemoteChecksumsPromise: Promise<Checksum[]>
  workPromise: Promise<void>
}> {
  if (ctx.options.themeEditorSync) {
    return reconcileAndPollThemeEditorChanges(
      theme,
      ctx.session,
      remoteChecksums,
      ctx.localThemeFileSystem,
      {
        noDelete: ctx.options.noDelete,
        ignore: ctx.options.ignore,
        only: ctx.options.only,
      },
      rejectBackgroundJob,
    )
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

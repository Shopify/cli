import {LocalDevServerContext} from './types.js'
import {ReloadTransport} from './reload-transport.js'
import {buildMiddleware} from './middleware.js'
import {createApp, toNodeListener} from 'h3'
import {createServer as createHttpServer, type RequestListener, type Server} from 'node:http'

/**
 * A running local dev server. `close()` shuts the HTTP listener down
 * gracefully, severing open connections first so the process can exit.
 */
export interface LocalDevServerInstance {
  close(): Promise<void>
}

/**
 * Collaborators the server depends on. Injectable so tests can substitute a
 * fake HTTP factory and never open a real socket.
 */
export interface LocalDevServerDeps {
  createServer?: (listener: RequestListener) => Server
}

/**
 * The local dev server: an h3 app wired to `node:http`.
 *
 * Mirrors the remote flow's server shape (h3 `createApp` → `toNodeListener` →
 * `node:http`, graceful `closeAllConnections()` + `close()`), but mounts only
 * the local middleware pipeline (host validation → reload transport → render).
 */
export function createLocalDevServer(
  ctx: LocalDevServerContext,
  transport: ReloadTransport,
  deps: LocalDevServerDeps = {},
): {start(): Promise<LocalDevServerInstance>; dispatch: ReturnType<typeof createApp>['handler']} {
  const app = createApp()

  for (const handler of buildMiddleware(ctx, transport)) {
    app.use(handler)
  }

  const createServer = deps.createServer ?? createHttpServer
  const server = createServer(toNodeListener(app))

  return {
    dispatch: app.handler.bind(app),
    start: async (): Promise<LocalDevServerInstance> => {
      return new Promise((resolve) =>
        server.listen({port: ctx.port, host: ctx.host}, () =>
          resolve({
            close: async () => {
              await new Promise<void>((_resolve) => {
                server.closeAllConnections()
                server.close(() => _resolve())
              })
            },
          }),
        ),
      )
    },
  }
}

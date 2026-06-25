import {LocalDevServerContext} from './types.js'
import {ReloadTransport} from './reload-transport.js'
import {LocalDevServerDeps, LocalDevServerInstance} from './server.js'
import {watchThemeFiles} from './watcher.js'
import {mountThemeFileSystem} from '../../../utilities/theme-fs.js'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 9292

/**
 * Collaborators the local dev server orchestration depends on. Injectable so
 * tests can drive the full lifecycle without touching the network, the file
 * system watcher, or the keyboard.
 */
export interface DevServeDeps {
  mountThemeFileSystem?: typeof mountThemeFileSystem
  createTransport?: () => ReloadTransport
  createServer?: (ctx: LocalDevServerContext, transport: ReloadTransport) => {start(): Promise<LocalDevServerInstance>}
  watch?: typeof watchThemeFiles
  serverDeps?: LocalDevServerDeps
}

/**
 * Entry point for the local dev server (`--live-reload local-hot-reload`).
 *
 * Mirrors `dev()`'s responsibilities — validate the directory, resolve
 * host/port, build the context, start the server, wire the keypress + abort
 * lifecycle — but renders locally and never sets up a remote Storefront
 * session. The render seam returns hello-world for this first draft.
 *
 * `devServe` resolves once the server is shut down (via Ctrl+C or an aborted
 * signal). It deliberately does NOT call `process.exit` so the caller stays in
 * control of the process lifecycle.
 */
export async function devServe(
  path: string,
  store: string,
  host: string,
  port: number,
  onBoot: () => void,
  onShutdown: () => void,
): Promise<void> {
  // if (!(await hasRequiredThemeDirectories(options.directory)) && !(await ensureDirectoryConfirmed(false))) {
  // }
  // const localThemeFileSystem = (deps.mountThemeFileSystem ?? mountThemeFileSystem)(options.directory, {
  //   filters: {ignore: options.ignore, only: options.only},
  //   noDelete: options.noDelete,
  //   notify: options.notify,
  // })
  // const host = options.host ?? DEFAULT_HOST
  // const port = await resolvePort(options.port)
  // const transport = (deps.createTransport ?? createReloadTransport)()
  // const ctx: LocalDevServerContext = {
  //   directory: options.directory,
  //   host,
  //   port,
  //   liveReload: options['live-reload'],
  //   localThemeFileSystem,
  //   lastRequestedPath: '',
  //   renderer: helloWorldRenderer(transport.clientScript),
  // }
  // const server = (deps.createServer ?? createLocalDevServer)(ctx, transport, deps.serverDeps)
  // const instance = await server.start()
  // const watcher = (deps.watch ?? watchThemeFiles)(ctx, () => {
  //   transport.triggerReload({type: 'full'})
  // })
  // await runUntilShutdown({options, instance, watcher, localThemeFileSystem, host, port})
}

/**
 * Resolves the port to bind to, reusing the shared TCP helpers and matching
 * the remote flow's UX: an explicitly-requested-but-taken port is a hard error.
 */
// async function resolvePort(requestedPort?: number): Promise<number> {
//   if (requestedPort) {
//     if (!(await checkPortAvailability(requestedPort))) {
//       throw new AbortError(
//         `Port ${requestedPort} is not available. Try a different port or remove the --port flag to use an available port.`,
//       )
//     }
//     return requestedPort
//   }

//   return getAvailableTCPPort(DEFAULT_PORT)
// }

/**
 * Renders the preview link, wires Ctrl+C and the abort signal to a single
 * graceful shutdown, and resolves once that shutdown completes.
 */
// async function runUntilShutdown(args: {
//   options: DevServeOptions
//   instance: LocalDevServerInstance
//   watcher: ThemeFileWatcher
//   localThemeFileSystem: ThemeFileSystem
//   host: string
//   port: number
// }): Promise<void> {
//   const {options, instance, watcher, host, port} = args
//   const localUrl = `http://${host}:${port}`

//   renderSuccess({
//     body: [
//       {
//         list: {
//           title: chalk.bold('Preview your theme (local) '),
//           items: [{link: {url: localUrl}}],
//         },
//       },
//     ],
//   })

//   if (options.open) {
//     openURL(localUrl).catch((error: Error) => {
//       renderWarning({headline: 'Failed to open the development server.', body: error.stack ?? error.message})
//     })
//   }

//   return new Promise<void>((resolve) => {
//     let closed = false

//     const shutdown = () => {
//       /* Both Ctrl+C and an aborted signal can race; only tear down once. */
//       if (closed) return
//       closed = true

//       Promise.all([instance.close(), watcher.close()])
//         .catch(() => {})
//         .finally(resolve)
//     }

//     readline.emitKeypressEvents(process.stdin)
//     const keypressHandler = (_str: string, key: {ctrl?: boolean; name?: string}) => {
//       if (key.ctrl && key.name === 'c') {
//         process.stdin.off('keypress', keypressHandler)
//         shutdown()
//       }
//     }
//     process.stdin.on('keypress', keypressHandler)
//     if (process.stdin.isTTY) {
//       process.stdin.setRawMode(true)
//     }

//     const onAbort = () => {
//       process.stdin.off('keypress', keypressHandler)
//       shutdown()
//     }

//     /* A signal that is already aborted never fires 'abort', so handle that
//        case eagerly; otherwise subscribe for a future abort. */
//     if (options.signal?.aborted) {
//       onAbort()
//     } else {
//       options.signal?.addEventListener('abort', onAbort)
//     }
//   })
// }

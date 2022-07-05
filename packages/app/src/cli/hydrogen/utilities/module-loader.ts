import {createServer} from 'vite'

export interface ModuleLoader {
  load: <T>(modulePath: string) => Promise<T>
  close: () => Promise<void>
}

export async function getModuleLoader(projectDirectory: string): Promise<ModuleLoader> {
  const watchers: {
    [key: string]: (modulePath: string) => void | Promise<void>
  } = {}
  const viteServer = await createServer({
    root: projectDirectory,
    cacheDir: undefined,
    server: {
      middlewareMode: 'ssr',
    },
    clearScreen: false,
    logLevel: 'silent',
    optimizeDeps: {
      entries: [],
    },
    build: {
      watch: {},
    },
    plugins: [
      {
        name: 'config-watch',
        handleHotUpdate: async (context) => {
          const watcherKey = Object.keys(watchers).find((pathPrefix) => context.file.startsWith(pathPrefix))
          if (!watcherKey) {
            return context.modules
          }
          await watchers[watcherKey](context.file)
          return context.modules
        },
      },
    ],
  })
  return {
    load: async <T>(modulePath: string) => {
      try {
        const module = await viteServer.ssrLoadModule(modulePath)
        return module as T
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        viteServer.ssrFixStacktrace(error)
        throw error
      }
    },
    close: viteServer.close,
  }
}

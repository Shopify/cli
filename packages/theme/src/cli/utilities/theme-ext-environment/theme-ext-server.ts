import {mountThemeExtensionFileSystem} from './theme-ext-fs.js'
import {DevServerContext} from '../theme-environment/types.js'
import {getHtmlHandler} from '../theme-environment/html.js'
import {getAssetsHandler} from '../theme-environment/local-assets.js'
import {getProxyHandler} from '../theme-environment/proxy.js'
import {emitHotReloadEvent, getHotReloadHandler} from '../theme-environment/hot-reload/server.js'
import {emptyThemeFileSystem} from '../theme-fs-empty.js'
import {initializeDevServerSession} from '../theme-environment/dev-server-session.js'
import {createApp, toNodeListener} from 'h3'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {extname} from '@shopify/cli-kit/node/path'
import {createServer} from 'node:http'
import type {Theme, ThemeFSEventPayload} from '@shopify/cli-kit/node/themes/types'

interface DevelopmentServerInstance {
  close: () => Promise<void>
}

export interface DevExtensionServerContext {
  adminSession: AdminSession
  themeExtensionPort: number
  themeExtensionDirectory: string
  storefrontPassword?: string
}

export async function initializeDevelopmentExtensionServer(theme: Theme, devExt: DevExtensionServerContext) {
  const ctx = await contextDevServerContext(theme, devExt)

  await setupInMemoryTemplateWatcher(ctx)

  return createDevelopmentExtensionServer(theme, ctx)
}

export function createDevelopmentExtensionServer(theme: Theme, ctx: DevServerContext) {
  const app = createApp()

  app.use(getHotReloadHandler(theme, ctx))
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

async function contextDevServerContext(
  theme: Theme,
  extensionContext: DevExtensionServerContext,
): Promise<DevServerContext> {
  const {adminSession, storefrontPassword, themeExtensionPort, themeExtensionDirectory: directory} = extensionContext

  const host = '127.0.0.1'
  const port = themeExtensionPort ?? 9293
  const localThemeFileSystem = emptyThemeFileSystem()
  const localThemeExtensionFileSystem = mountThemeExtensionFileSystem(directory)
  await localThemeExtensionFileSystem.ready()

  const session = await initializeDevServerSession(theme.id.toString(), adminSession, undefined, storefrontPassword)

  return {
    session,
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory,
    options: {
      themeEditorSync: false,
      noDelete: false,
      ignore: [],
      only: [],
      host,
      port: port.toString(),
      liveReload: 'hot-reload',
      open: false,
      silence: false,
    },
  }
}

export async function setupInMemoryTemplateWatcher(ctx: DevServerContext) {
  const fileSystem = ctx.localThemeExtensionFileSystem

  const handleFileUpdate = ({fileKey, onContent, onSync: _}: ThemeFSEventPayload) => {
    const extension = extname(fileKey)
    const type = fileKey.split('/')[0]

    onContent(() => {
      if (type === 'assets' && extension === '.css') {
        return emitHotReloadEvent({type: 'extCss', key: fileKey})
      }

      if (type === 'blocks') {
        return emitHotReloadEvent({type: 'extAppBlock', key: fileKey})
      }

      emitHotReloadEvent({type: 'full', key: fileKey})
    })
  }

  fileSystem.addEventListener('add', handleFileUpdate)
  fileSystem.addEventListener('change', handleFileUpdate)

  return fileSystem.ready().then(async () => {
    return fileSystem.startWatcher()
  })
}

export function getExtensionInMemoryTemplates(ctx: DevServerContext) {
  const replaceExtTemplates: {[key: string]: string} = {}
  const fileSystem = ctx.localThemeExtensionFileSystem

  for (const key of fileSystem.unsyncedFileKeys) {
    const file = fileSystem.files.get(key)
    const content = file?.value ?? file?.attachment

    if (content) {
      replaceExtTemplates[key] = content
    }
  }

  return replaceExtTemplates
}

import {
  corsMiddleware,
  devConsoleAssetsMiddleware,
  devConsoleIndexMiddleware,
  getAppAssetsMiddleware,
  getExtensionAssetMiddleware,
  getExtensionPayloadMiddleware,
  getExtensionPointMiddleware,
  getExtensionsPayloadMiddleware,
  getLogMiddleware,
  noCacheMiddleware,
  redirectToDevConsoleMiddleware,
} from './server/middlewares.js'
import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from './payload/store.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {createApp, createRouter, toNodeListener} from 'h3'
import {createServer} from 'http'

interface SetupHTTPServerOptions {
  devOptions: ExtensionsPayloadStoreOptions
  payloadStore: ExtensionsPayloadStore
  getExtensions: () => ExtensionInstance[]
  getAppAssets?: () => Record<string, string> | undefined
}

export function setupHTTPServer(options: SetupHTTPServerOptions) {
  const httpApp = createApp()
  const httpRouter = createRouter()

  httpApp.use(getLogMiddleware(options))
  httpApp.use(corsMiddleware)
  httpApp.use(noCacheMiddleware)
  if (options.getAppAssets) {
    httpRouter.use('/extensions/assets/:assetKey/**:filePath', getAppAssetsMiddleware(options.getAppAssets))
  }
  httpRouter.use('/extensions/dev-console', devConsoleIndexMiddleware)
  httpRouter.use('/extensions/dev-console/assets/**:assetPath', devConsoleAssetsMiddleware)
  httpRouter.use('/extensions/:extensionId', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/:extensionPointTarget', getExtensionPointMiddleware(options))
  httpRouter.use('/extensions/:extensionId/assets/**:assetPath', getExtensionAssetMiddleware(options))
  httpRouter.use('/extensions', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/extensions/', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/', redirectToDevConsoleMiddleware)

  httpApp.use(httpRouter)

  const httpServer = createServer(toNodeListener(httpApp))
  httpServer.listen(options.devOptions.port, 'localhost')
  return httpServer
}

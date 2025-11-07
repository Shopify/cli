import {
  corsMiddleware,
  devConsoleAssetsMiddleware,
  devConsoleIndexMiddleware,
  getExtensionAssetMiddleware,
  getExtensionPayloadMiddleware,
  getExtensionPointMiddleware,
  getExtensionsPayloadMiddleware,
  getHostedHtmlMiddleware,
  getLogMiddleware,
  noCacheMiddleware,
  redirectToDevConsoleMiddleware,
} from './server/middlewares.js'
import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from './payload/store.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {createApp, createRouter} from 'h3'
import {createServer} from 'http'

interface SetupHTTPServerOptions {
  devOptions: ExtensionsPayloadStoreOptions
  payloadStore: ExtensionsPayloadStore
  getExtensions: () => ExtensionInstance[]
}

export function setupHTTPServer(options: SetupHTTPServerOptions) {
  const httpApp = createApp()
  const httpRouter = createRouter()

  httpApp.use(getLogMiddleware(options))
  httpApp.use(corsMiddleware)
  httpApp.use(noCacheMiddleware)
  httpRouter.use('/extensions/dev-console', devConsoleIndexMiddleware)
  httpRouter.use('/extensions/dev-console/assets/**:assetPath', devConsoleAssetsMiddleware)
  // Hosted HTML middleware should be checked before general extension payload
  httpRouter.use('/extensions/:extensionId', getHostedHtmlMiddleware(options))
  httpRouter.use('/extensions/:extensionId/', getHostedHtmlMiddleware(options))
  httpRouter.use('/extensions/:extensionId', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/:extensionPointTarget', getExtensionPointMiddleware(options))
  httpRouter.use('/extensions/:extensionId/assets/**:assetPath', getExtensionAssetMiddleware(options))
  httpRouter.use('/extensions', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/extensions/', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/', redirectToDevConsoleMiddleware)

  httpApp.use(httpRouter)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const httpServer = createServer(httpApp)
  httpServer.listen(options.devOptions.port, 'localhost')
  return httpServer
}

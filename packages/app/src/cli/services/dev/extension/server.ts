import {
  corsMiddleware,
  getExtensionAssetMiddleware,
  getExtensionPayloadMiddleware,
  getExtensionPointMiddleware,
  getExtensionsPayloadMiddleware,
  getLogMiddleware,
  noCacheMiddleware,
  redirectToExtensionsMiddleware,
} from './server/middlewares.js'
import {ExtensionsPayloadStore, ExtensionsPayloadStoreOptions} from './payload/store.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {createApp, createRouter, toNodeListener} from 'h3'
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
  httpRouter.use('/extensions/dev-console', redirectToExtensionsMiddleware)
  httpRouter.use('/extensions/:extensionId', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/', getExtensionPayloadMiddleware(options))
  httpRouter.use('/extensions/:extensionId/:extensionPointTarget', getExtensionPointMiddleware(options))
  httpRouter.use('/extensions/:extensionId/assets/**:assetPath', getExtensionAssetMiddleware(options))
  httpRouter.use('/extensions', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/extensions/', getExtensionsPayloadMiddleware(options))
  httpRouter.use('/', redirectToExtensionsMiddleware)

  httpApp.use(httpRouter)

  const httpServer = createServer(toNodeListener(httpApp))
  httpServer.listen(options.devOptions.port, 'localhost')
  return httpServer
}

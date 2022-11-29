import {
  corsMiddleware,
  devConsoleAssetsMiddleware,
  devConsoleIndexMiddleware,
  getExtensionAssetMiddleware,
  getExtensionPayloadMiddleware,
  getExtensionPointMiddleware,
  getExtensionsPayloadMiddleware,
  getLogMiddleware,
  noCacheMiddleware,
  redirectToDevConsoleMiddleware,
} from './server/middlewares.js'
import {ExtensionsPayloadStore} from './payload/store.js'
import {ExtensionDevOptions} from '../extension.js'
import {http} from '@shopify/cli-kit'
import {createServer} from 'http'

interface SetupHTTPServerOptions {
  devOptions: ExtensionDevOptions
  payloadStore: ExtensionsPayloadStore
}

export function setupHTTPServer(options: SetupHTTPServerOptions) {
  const httpApp = http.createApp()
  const httpRouter = http.createRouter()

  httpApp.use(getLogMiddleware(options))
  httpApp.use(corsMiddleware)
  httpApp.use(noCacheMiddleware)
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

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const httpServer = createServer(httpApp)
  httpServer.listen(options.devOptions.port)
  return httpServer
}

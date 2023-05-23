import {getCartPathFromExtensions} from './extension/utilities.js'
import {setupWebsocketConnection} from './extension/websocket.js'
import {setupBundlerAndFileWatcher} from './extension/bundler.js'
import {setupHTTPServer} from './extension/server.js'
import {ExtensionsPayloadStore, getExtensionsPayloadStoreRawPayload} from './extension/payload/store.js'
import {AppInterface} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

export interface ExtensionDevOptions {
  /**
   * Standard output stream to send the output through.
   */
  stdout: Writable
  /**
   * Standard error stream to send the error output through.
   */
  stderr: Writable

  /**
   * Signal to abort the build process.
   */
  signal: AbortSignal

  /**
   * Overrides the default build directory.
   */
  buildDirectory?: string

  /**
   * The extension to be built.
   */
  extensions: UIExtension[]

  /**
   * The app that contains the extension.
   */
  app: AppInterface

  /**
   * The ID of the app that contains the extension.
   */
  id?: string

  /**
   * The app identifier
   */
  apiKey: string

  /**
   * URL where the extension is locally served from. It's usually the tunnel URL
   */
  url: string

  /**
   * The port where the extension is hosted.
   * It's usually the tunnel port
   */
  port: number

  /**
   * The store where the extension wants to be previewed
   */
  storeFqdn: string

  /**
   * List of granted approval scopes belonging to the parent app
   */
  grantedScopes: string[]

  /**
   * Product variant ID, used for UI extensions targeting Checkout
   * If that extension is present, this is mandatory
   */
  checkoutCartUrl?: string

  /**
   * Subscription product URL, used for subscription_ui_extensions
   * If not provided the first product in the store will be used
   */
  subscriptionProductUrl?: string

  /**
   * Fixed version for the Dev Server's manifest.
   * This is exposed in the JSON payload for clients connecting to the Dev Server
   */
  manifestVersion: string
}

export async function devUIExtensions(options: ExtensionDevOptions): Promise<void> {
  const devOptions: ExtensionDevOptions = {
    ...options,
    checkoutCartUrl: await getCartPathFromExtensions(options.extensions, options.storeFqdn, options.checkoutCartUrl),
  }

  const payloadStoreOptions = {
    ...devOptions,
    websocketURL: getWebSocketUrl(options.url),
  }
  const payloadStoreRawPayload = await getExtensionsPayloadStoreRawPayload(payloadStoreOptions)
  const payloadStore = new ExtensionsPayloadStore(payloadStoreRawPayload, payloadStoreOptions)

  outputDebug(`Setting up the UI extensions HTTP server...`, options.stdout)
  const httpServer = setupHTTPServer({devOptions, payloadStore})

  outputDebug(`Setting up the UI extensions Websocket server...`, options.stdout)
  const websocketConnection = setupWebsocketConnection({...options, httpServer, payloadStore})
  outputDebug(`Setting up the UI extensions bundler and file watching...`, options.stdout)
  const fileWatcher = await setupBundlerAndFileWatcher({devOptions, payloadStore})

  options.signal.addEventListener('abort', () => {
    fileWatcher.close()
    websocketConnection.close()
    httpServer.close()
  })
}

function getWebSocketUrl(url: ExtensionDevOptions['url']) {
  const websocketURL = new URL('/extensions', url)
  websocketURL.protocol = 'wss:'

  return websocketURL.toString()
}

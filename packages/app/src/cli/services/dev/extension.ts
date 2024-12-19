/* eslint-disable no-await-in-loop */
import {setupWebsocketConnection} from './extension/websocket.js'
import {setupHTTPServer} from './extension/server.js'
import {
  ExtensionsPayloadStore,
  ExtensionsPayloadStoreOptions,
  getExtensionsPayloadStoreRawPayload,
} from './extension/payload/store.js'
import {AppEvent, AppEventWatcher, EventType} from './app-events/app-event-watcher.js'
import {buildCartURLIfNeeded} from './extension/utilities.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
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
  extensions: ExtensionInstance[]

  /**
   * The ID of the app that contains the extension.
   */
  id?: string

  /**
   * The name of the app containing the extensions.
   */
  appName: string

  /**
   * Location of the app code.
   */
  appDirectory: string

  /**
   * File based environment variables for the app
   */
  appDotEnvFile?: DotEnvFile

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
   * Id of the store where the extension wants to be previewed
   */
  storeId: string

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

  /**
   * The app watcher that emits events when the app is updated
   */
  appWatcher: AppEventWatcher
}

export async function devUIExtensions(options: ExtensionDevOptions): Promise<void> {
  const payloadOptions: ExtensionsPayloadStoreOptions = {
    ...options,
    websocketURL: getWebSocketUrl(options.url),
  }

  // NOTE: Always use `payloadOptions`, never `options` directly. This way we can mutate `payloadOptions` without
  // affecting the original `options` object and we only need to care about `payloadOptions` in this function.

  const bundlePath = payloadOptions.appWatcher.buildOutputPath
  const payloadStoreRawPayload = await getExtensionsPayloadStoreRawPayload(payloadOptions, bundlePath)
  const payloadStore = new ExtensionsPayloadStore(payloadStoreRawPayload, payloadOptions)

  outputDebug(`Setting up the UI extensions HTTP server...`, payloadOptions.stdout)
  const httpServer = setupHTTPServer({devOptions: payloadOptions, payloadStore})

  outputDebug(`Setting up the UI extensions Websocket server...`, payloadOptions.stdout)
  const websocketConnection = setupWebsocketConnection({...payloadOptions, httpServer, payloadStore})
  outputDebug(`Setting up the UI extensions bundler and file watching...`, payloadOptions.stdout)

  const eventHandler = async ({extensionEvents}: AppEvent) => {
    for (const event of extensionEvents) {
      const status = event.buildResult?.status === 'ok' ? 'success' : 'error'

      switch (event.type) {
        case EventType.Created:
          payloadOptions.extensions.push(event.extension)

          if (!payloadOptions.checkoutCartUrl) {
            // If the checkoutCartUrl is not set, check again and build the URL in case the new extension is a checkout extension.
            try {
              const cartUrl = await buildCartURLIfNeeded(payloadOptions.extensions, payloadOptions.storeFqdn)
              // eslint-disable-next-line require-atomic-updates
              payloadOptions.checkoutCartUrl = cartUrl
              // eslint-disable-next-line no-catch-all/no-catch-all
            } catch (error) {
              outputDebug(
                `Failed to build a cart URL for your checkout extension. Use the --checkout-cart-url flag to set a fixed URL.`,
                payloadOptions.stdout,
              )
            }
          }

          await payloadStore.addExtension(event.extension, bundlePath)
          break
        case EventType.Updated:
          await payloadStore.updateExtension(event.extension, payloadOptions, bundlePath, {status})
          break
        case EventType.Deleted:
          payloadOptions.extensions = payloadOptions.extensions.filter((ext) => ext.devUUID !== event.extension.devUUID)
          await payloadStore.deleteExtension(event.extension)
          break
      }
    }
  }

  payloadOptions.appWatcher.onEvent(eventHandler).onStart(eventHandler)

  payloadOptions.signal.addEventListener('abort', () => {
    outputDebug('Closing the UI extensions dev server...')
    websocketConnection.close()
    httpServer.close()
  })
}

function getWebSocketUrl(url: ExtensionDevOptions['url']) {
  const websocketURL = new URL('/extensions', url)
  websocketURL.protocol = 'wss:'

  return websocketURL.toString()
}

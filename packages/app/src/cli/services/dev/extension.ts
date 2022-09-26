import {getCartPathFromExtensions} from './extension/utilities.js'
import {setupWebsocketConnection} from './extension/websocket.js'
import {setupBundlerAndFileWatcher} from './extension/bundler.js'
import {setupHTTPServer} from './extension/server.js'
import {ExtensionsPayloadStore, getExtensionsPayloadStoreRawPayload} from './extension/payload/store.js'
import {AppInterface} from '../../models/app/app.js'
import {UIExtension} from '../../models/app/extensions.js'
import {extensionConfig} from '../../utilities/extensions/configuration.js'
import {runGoExtensionsCLI} from '../../utilities/extensions/cli.js'
import {output, abort, yaml, environment} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

export interface ExtensionDevOptions {
  stdout: Writable
  stderr: Writable
  signal: abort.Signal
  buildDirectory?: string
  extensions: UIExtension[]
  app: AppInterface
  apiKey: string
  url: string
  port: number
  storeFqdn: string

  /**
   * List of granted approval scopes belonging to the parent app
   */
  grantedScopes: string[]

  /**
   * Product variant ID, used for checkout_ui_extensions
   * If that extension is present, this is mandatory
   */
  checkoutCartUrl?: string

  /**
   * Subscription product URL, used for subscription_ui_extensions
   * If not provided the first product in the store will be used
   */
  subscriptionProductUrl?: string
}

export async function devUIExtensions(options: ExtensionDevOptions): Promise<void> {
  if (await environment.local.isShopify()) {
    await devUIExtensionsWithNode(options)
  } else {
    await devUIExtensionsWithGo(options)
  }
}

export async function devUIExtensionsWithGo(options: ExtensionDevOptions): Promise<void> {
  const config = await extensionConfig({includeResourceURL: true, ...options})
  output.debug(output.content`Dev'ing extension with configuration:
${output.token.json(config)}
`)
  const input = yaml.encode(config)
  await runGoExtensionsCLI(['serve', '-'], {
    cwd: options.app.directory,
    signal: options.signal,
    stdout: options.stdout,
    stderr: options.stderr,
    input,
  })
}

export async function devUIExtensionsWithNode(options: ExtensionDevOptions): Promise<void> {
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

  output.debug(`Setting up the UI extensions HTTP server...`)
  const httpServer = setupHTTPServer({devOptions, payloadStore})

  output.debug(`Setting up the UI extensions Websocket server...`)
  const websocketConnection = setupWebsocketConnection({
    httpServer,
    payloadStore,
  })
  output.debug(`Setting up the UI extensions bundler and file watching...`)
  const fileWatcher = setupBundlerAndFileWatcher({devOptions, payloadStore})

  options.signal.addEventListener('abort', () => {
    httpServer.close()
    websocketConnection.close()
    fileWatcher.close()
  })
}

export function getWebSocketUrl(url: ExtensionDevOptions['url']) {
  const websocketURL = new URL('/extensions', url)
  websocketURL.protocol = 'wss:'

  return websocketURL.toString()
}

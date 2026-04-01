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
import {joinPath} from '@shopify/cli-kit/node/path'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {DotEnvFile} from '@shopify/cli-kit/node/dot-env'
import {Writable} from 'stream'
import type {FSWatcher} from 'chokidar'

interface AppAssets {
  [key: string]: string
}

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

  /**
   * Map of asset key to absolute directory path for app-level assets (e.g., admin static_root)
   */
  appAssets?: AppAssets
}

export function resolveAppAssets(allExtensions: ExtensionInstance[]): Record<string, string> {
  const appAssets: Record<string, string> = {}
  const adminExtension = allExtensions.find((ext) => ext.specification.identifier === 'admin')
  if (adminExtension) {
    const staticRootPath = getPathValue<string>(adminExtension.configuration, 'admin.static_root')
    if (staticRootPath) {
      appAssets.staticRoot = joinPath(adminExtension.directory, staticRootPath)
    }
  }
  return appAssets
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
  let extensions = payloadOptions.extensions

  const getExtensions = () => {
    return extensions
  }

  outputDebug(`Setting up the UI extensions HTTP server...`, payloadOptions.stdout)
  const currentAppAssets = payloadOptions.appAssets
  const httpServer = setupHTTPServer({
    devOptions: payloadOptions,
    payloadStore,
    getExtensions,
    appAssets: currentAppAssets,
  })

  outputDebug(`Setting up the UI extensions Websocket server...`, payloadOptions.stdout)
  const websocketConnection = setupWebsocketConnection({...payloadOptions, httpServer, payloadStore})
  outputDebug(`Setting up the UI extensions bundler and file watching...`, payloadOptions.stdout)

  // Set up asset directory watchers
  let assetWatchers: FSWatcher[] = []
  let debounceTimers: ReturnType<typeof setTimeout>[] = []

  function createDebouncedAssetUpdater(assetKey: string) {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        payloadStore.updateAppAssetTimestamp(assetKey)
      }, 200)
      debounceTimers.push(debounceTimer)
    }
  }

  function clearDebounceTimers() {
    for (const timer of debounceTimers) {
      clearTimeout(timer)
    }
    debounceTimers = []
  }

  async function startAssetWatchers(assets: Record<string, string>) {
    // Clear pending debounce timers and close existing watchers
    clearDebounceTimers()
    await Promise.all(assetWatchers.map((watcher) => watcher.close()))
    // eslint-disable-next-line require-atomic-updates
    assetWatchers = []

    const {default: chokidar} = await import('chokidar')
    for (const [assetKey, directoryPath] of Object.entries(assets)) {
      const exists = await fileExists(directoryPath)
      if (!exists) continue

      const watcher = chokidar.watch(directoryPath, {ignoreInitial: true})
      watcher.on('all', createDebouncedAssetUpdater(assetKey))
      assetWatchers.push(watcher)
    }
  }

  if (currentAppAssets && Object.keys(currentAppAssets).length > 0) {
    await startAssetWatchers(currentAppAssets)
  }

  const eventHandler = async ({appWasReloaded, app, extensionEvents}: AppEvent) => {
    if (appWasReloaded) {
      extensions = app.allExtensions.filter((ext) => ext.isPreviewable)

      // Re-resolve app assets in case admin extension was added/removed/changed
      const newAppAssets = resolveAppAssets(app.allExtensions)
      const hasAssets = Object.keys(newAppAssets).length > 0
      payloadOptions.appAssets = hasAssets ? newAppAssets : undefined
      payloadStore.updateAppAssets(payloadOptions.appAssets, payloadOptions.url)
      await startAssetWatchers(hasAssets ? newAppAssets : {})
    }

    for (const event of extensionEvents) {
      if (!event.extension.isPreviewable) continue
      const status = event.buildResult?.status === 'ok' ? 'success' : 'error'

      const error =
        event.buildResult?.status === 'error'
          ? {message: event.buildResult.error, file: event.buildResult.file}
          : undefined

      switch (event.type) {
        case EventType.Created:
          payloadOptions.extensions.push(event.extension)
          if (!payloadOptions.checkoutCartUrl) {
            const cartUrl = await buildCartURLIfNeeded(payloadOptions.extensions, payloadOptions.storeFqdn)
            // eslint-disable-next-line require-atomic-updates
            payloadOptions.checkoutCartUrl = cartUrl
          }
          await payloadStore.addExtension(event.extension, bundlePath)
          break
        case EventType.Updated:
          await payloadStore.updateExtension(event.extension, payloadOptions, bundlePath, {status, error})
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
    clearDebounceTimers()
    for (const watcher of assetWatchers) {
      watcher.close().catch(() => {})
    }
    websocketConnection.close()
    httpServer.close()
  })
}

export function getWebSocketUrl(url: string) {
  const websocketURL = new URL('/extensions', url)
  websocketURL.protocol = 'wss:'

  return websocketURL.toString()
}

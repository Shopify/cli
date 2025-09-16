/* eslint-disable tsdoc/syntax */
import {FileWatcher, OutputContextOptions} from './file-watcher.js'
import {ESBuildContextManager} from './app-watcher-esbuild.js'
import {handleWatcherEvents} from './app-event-watcher-handler.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, rmdir} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {formatMessagesSync, Message} from 'esbuild'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import EventEmitter from 'events'

/**
This is the entry point to start watching events in an app. This process has 3 steps:
1. The file system watcher (file-watcher.ts) will detect changes in the file system and emit events.
2. The app-event-watcher (this file) will receive the events and process them, reloading the app if necessary.
3. The consumer of the processed events will receive the updated app and the affected extensions.

Since an extension folder can contain multiple extensions defined in the same toml, all file system events can
potentially affect multiple extensions, an AppEvent will always include an array with all affected extensions.

Examples:
1. A file is updated in an extension folder (/extensions/my_extension/index.js)
 -> file-watcher will emit a `file_updated` event
  -> app-event-watcher will determine that all extensions in the `my_extension` directory are affected
    -> The consumer will receive the updated app and the affected extension(s)

2. A new directory is created in the extensions folder (/extensions/new_extension)
  -> file-watcher will emit a `extension_folder_created` event
    -> app-event-watcher will determine that an extension(s) was(were) created and reload the app
      -> The consumer will receive the updated app and the created extension(s)

3. A directory is removed from the file system (/extensions/my_extension)
  -> file-watcher will emit a `extension_folder_deleted` event
    -> app-event-watcher will determine that all extensions in `my_extension` were deleted and remove them from the app
      -> The consumer will receive the updated app and the deleted extension(s)

4. A toml file is updated (/extensions/my_extension/extension.toml)
  -> file-watcher will emit a `extensions_config_updated` event
    -> app-event-watcher will compare the old and new extensions to determine which were created, deleted or updated
      -> The consumer will receive the updated app and the created, deleted and updated extensions

5. The app.toml is updated
  -> file-watcher will emit a `extensions_config_updated` event
    -> app-event-watcher will compare the old and new config to determine which extensions were created, deleted or updated
      -> The consumer will receive the updated app and the created, deleted and updated extensions
 */

/**
 * The type of the extension event
 *
 * - Updated: The extension was updated
 * - Deleted: The extension was deleted
 * - Created: The extension was created
 */
export enum EventType {
  Updated = 'changed',
  Deleted = 'deleted',
  Created = 'created',
}

export interface ExtensionEvent {
  type: EventType
  extension: ExtensionInstance
  buildResult?: ExtensionBuildResult
}

/**
 * An AppEvent is the result of processing a file system event.
 * It includes the updated app and the affected extensions.
 * The startTime is the time when the initial file-system event was received, it can be used by the consumer
 * to determine how long it took to process the event.
 */
export interface AppEvent {
  app: AppLinkedInterface
  extensionEvents: ExtensionEvent[]
  path: string
  startTime: [number, number]
  appWasReloaded?: boolean
}

type ExtensionBuildResult = {status: 'ok'; uid: string} | {status: 'error'; error: string; uid: string}

/**
 * App event watcher will emit events when changes are detected in the file system.
 */
export class AppEventWatcher extends EventEmitter {
  buildOutputPath: string
  private app: AppLinkedInterface
  private options: OutputContextOptions
  private readonly appURL?: string
  private readonly esbuildManager: ESBuildContextManager
  private started = false
  private ready = false
  private initialEvents: ExtensionEvent[] = []
  private fileWatcher?: FileWatcher

  constructor(
    app: AppLinkedInterface,
    appURL?: string,
    buildOutputPath?: string,
    esbuildManager?: ESBuildContextManager,
    fileWatcher?: FileWatcher,
  ) {
    super()
    this.app = app
    this.appURL = appURL
    this.buildOutputPath = buildOutputPath ?? joinPath(app.directory, '.shopify', 'dev-bundle')
    // Default options, to be overwritten by the start method
    this.options = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
    this.esbuildManager =
      esbuildManager ??
      new ESBuildContextManager({
        outputPath: this.buildOutputPath,
        dotEnvVariables: this.app.dotenv?.variables ?? {},
        url: this.appURL ?? '',
        ...this.options,
      })
    this.fileWatcher = fileWatcher
  }

  async start(options?: OutputContextOptions, buildExtensionsFirst = true) {
    if (this.started) return
    this.started = true

    this.options = options ?? this.options
    this.esbuildManager.setAbortSignal(this.options.signal)

    // If there is a previous build folder, delete it
    if (await fileExists(this.buildOutputPath)) await rmdir(this.buildOutputPath, {force: true})
    await mkdir(this.buildOutputPath)

    // Start the esbuild bundler for extensions that require it
    await this.esbuildManager.createContexts(this.app.realExtensions.filter((ext) => ext.isESBuildExtension))

    // Initial build of all extensions
    if (buildExtensionsFirst) {
      this.initialEvents = this.app.realExtensions.map((ext) => ({type: EventType.Updated, extension: ext}))
      await this.buildExtensions(this.initialEvents)
    }

    this.fileWatcher = this.fileWatcher ?? new FileWatcher(this.app, this.options)
    this.fileWatcher.onChange((events) => {
      handleWatcherEvents(events, this.app, this.options)
        .then(async (appEvent) => {
          if (appEvent?.extensionEvents.length === 0) outputDebug('Change detected, but no extensions were affected')
          if (!appEvent) return

          this.app = appEvent.app
          if (appEvent.appWasReloaded) await this.fileWatcher?.updateApp(this.app)
          await this.esbuildManager.updateContexts(appEvent)

          // Find affected created/updated extensions and build them
          const buildableEvents = appEvent.extensionEvents.filter((extEvent) => extEvent.type !== EventType.Deleted)

          // Build the created/updated extensions and update the extension events with the build result
          await this.buildExtensions(buildableEvents)

          // Find deleted extensions and delete their previous build output
          await this.deleteExtensionsBuildOutput(appEvent)
          this.emit('all', appEvent)
        })
        .catch((error) => {
          this.emit('error', error)
        })
    })
    await this.fileWatcher.start()

    this.ready = true
    this.emit('ready', {app: this.app, extensionEvents: this.initialEvents})
  }

  /**
   * Register as a listener for AppEvents.
   *
   * @param listener - The listener function to add
   * @returns The AppEventWatcher instance
   */
  onEvent(listener: (appEvent: AppEvent) => Promise<void> | void) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.addListener('all', listener)
    return this
  }

  /**
   * Register as a listener for the start event.
   * This event is emitted when the watcher is ready to start processing events (after the initial extension build).
   *
   * @param listener - The listener function to add
   * @returns The AppEventWatcher instance
   */
  onStart(listener: (appEvent: AppEvent) => Promise<void> | void) {
    if (this.ready) {
      const event: AppEvent = {app: this.app, extensionEvents: this.initialEvents, startTime: [0, 0], path: ''}
      listener(event)?.catch(() => {})
    } else {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      this.once('ready', listener)
    }
    return this
  }

  onError(listener: (error: Error) => Promise<void> | void) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.addListener('error', listener)
    return this
  }

  /**
   * Deletes the build output for the given extensions.
   *
   * This is just a cleanup function after detecting that an extension has been deleted.
   */
  private async deleteExtensionsBuildOutput(appEvent: AppEvent) {
    const extensions = appEvent.extensionEvents
      .filter((extEvent) => extEvent.type === EventType.Deleted)
      .map((extEvent) => extEvent.extension)
    const promises = extensions.map(async (ext) => {
      const outputPath = joinPath(this.buildOutputPath, ext.getOutputFolderId())
      return rmdir(outputPath, {force: true})
    })
    await Promise.all(promises)
  }

  /**
   * Builds all given extensions.
   * ESBuild extensions will be built using their own ESBuild context, other extensions will be built using the default
   * buildForBundle method.
   */
  private async buildExtensions(extensionEvents: ExtensionEvent[]) {
    const promises = extensionEvents.map(async (extEvent) => {
      const ext = extEvent.extension
      return useConcurrentOutputContext({outputPrefix: ext.handle, stripAnsi: false}, async () => {
        try {
          if (this.esbuildManager.contexts?.[ext.uid]?.length) {
            await this.esbuildManager.rebuildContext(ext)
            this.options.stdout.write(`Build successful`)
          } else {
            await this.buildExtension(ext)
          }
          extEvent.buildResult = {status: 'ok', uid: ext.uid}
          // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
        } catch (error: any) {
          // If there is an `errors` array, it's an esbuild error, format it and log it
          // If not, just print the error message to stderr.
          const errors: Message[] = error.errors ?? []
          if (errors.length) {
            const formattedErrors = formatMessagesSync(errors, {kind: 'error', color: !isUnitTest()})
            formattedErrors.forEach((error) => {
              this.options.stderr.write(error)
            })
          } else {
            this.options.stderr.write(error.message)
          }
          extEvent.buildResult = {status: 'error', error: error.message, uid: ext.uid}
        }
      })
    })
    return Promise.all(promises)
  }

  /**
   * Build a single non-esbuild extension using the default buildForBundle method.
   * @param extension - The extension to build
   */
  private async buildExtension(extension: ExtensionInstance): Promise<void> {
    const buildOptions: ExtensionBuildOptions = {
      app: this.app,
      stdout: this.options.stdout,
      stderr: this.options.stderr,
      useTasks: false,
      environment: 'development',
      appURL: this.appURL,
    }
    await extension.buildForBundle(buildOptions, this.buildOutputPath)
  }
}

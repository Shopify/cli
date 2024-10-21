/* eslint-disable tsdoc/syntax */
import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {appDiff} from './app-diffing.js'
import {ESBuildContextManager} from './app-watcher-esbuild.js'
import {AppInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../models/app/loader.js'
import {ExtensionBuildOptions} from '../../build/extension.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, mkdir, rmdir} from '@shopify/cli-kit/node/fs'
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
  Updated,
  Deleted,
  Created,
}

export interface ExtensionEvent {
  type: EventType
  extension: ExtensionInstance
}

/**
 * An AppEvent is the result of processing a file system event.
 * It includes the updated app and the affected extensions.
 * The startTime is the time when the initial file-system event was received, it can be used by the consumer
 * to determine how long it took to process the event.
 */
export interface AppEvent {
  app: AppInterface
  extensionEvents: ExtensionEvent[]
  path: string
  startTime: [number, number]
}

interface HandlerInput {
  event: WatcherEvent
  app: AppInterface
  extensions: ExtensionInstance[]
  options: OutputContextOptions
}

type Handler = (input: HandlerInput) => Promise<AppEvent>
type ExtensionBuildResult = {status: 'ok'; handle: string} | {status: 'error'; error: string; handle: string}

const handlers: {[key in WatcherEvent['type']]: Handler} = {
  extension_folder_deleted: ExtensionFolderDeletedHandler,
  file_created: FileChangeHandler,
  file_deleted: FileChangeHandler,
  file_updated: FileChangeHandler,
  extension_folder_created: ReloadAppHandler,
  extensions_config_updated: ReloadAppHandler,
  app_config_deleted: AppConfigDeletedHandler,
}

/**
 * App event watcher will emit events when changes are detected in the file system.
 */
export class AppEventWatcher extends EventEmitter {
  buildOutputPath: string
  private app: AppInterface
  private readonly options: OutputContextOptions
  private appURL?: string
  private esbuildManager: ESBuildContextManager

  constructor(
    app: AppInterface,
    appURL?: string,
    options?: OutputContextOptions,
    buildOutputPath?: string,
    contextManager?: ESBuildContextManager,
  ) {
    super()
    this.app = app
    this.appURL = appURL
    this.buildOutputPath = buildOutputPath ?? joinPath(app.directory, '.shopify', 'bundle')
    this.options = options ?? {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
    this.esbuildManager =
      contextManager ??
      new ESBuildContextManager({
        outputPath: this.buildOutputPath,
        dotEnvVariables: this.app.dotenv?.variables ?? {},
        url: this.appURL ?? '',
        ...this.options,
      })
  }

  async start() {
    // If there is a previous build folder, delete it
    if (await fileExists(this.buildOutputPath)) await rmdir(this.buildOutputPath, {force: true})
    await mkdir(this.buildOutputPath)

    // Start the esbuild bundler for extensions that require it
    await this.esbuildManager.createContexts(this.app.realExtensions.filter((ext) => ext.isESBuildExtension))

    // Initial build of all extensions
    await this.buildExtensions(this.app.realExtensions)

    // Start the file system watcher
    await startFileWatcher(this.app, this.options, (event) => {
      // A file/folder can contain multiple extensions, this is the list of extensions possibly affected by the change
      const extensions = this.app.realExtensions.filter((ext) => ext.directory === event.extensionPath)

      handlers[event.type]({event, app: this.app, extensions, options: this.options})
        .then(async (appEvent) => {
          this.app = appEvent.app
          if (appEvent.extensionEvents.length === 0) {
            outputDebug('Change detected, but no extensions were affected', this.options.stdout)
            return
          }
          await this.esbuildManager.updateContexts(appEvent)

          // Find affected created/updated extensions and build them
          const extensions = appEvent.extensionEvents
            .filter((extEvent) => extEvent.type !== EventType.Deleted)
            .map((extEvent) => extEvent.extension)

          await this.buildExtensions(extensions)

          const deletedExtensions = appEvent.extensionEvents.filter((extEvent) => extEvent.type === EventType.Deleted)
          await this.deleteExtensionsBuildOutput(deletedExtensions.map((extEvent) => extEvent.extension))

          this.emit('all', appEvent)
        })
        .catch((error) => {
          this.options.stderr.write(`Error handling event: ${error.message}`)
        })
    })
  }

  async deleteExtensionsBuildOutput(extensions: ExtensionInstance[]) {
    const promises = extensions.map(async (ext) => {
      const outputPath = joinPath(this.buildOutputPath, ext.getOutputFolderId())
      return rmdir(outputPath, {force: true})
    })
    await Promise.all(promises)
  }

  onEvent(listener: (appEvent: AppEvent) => Promise<void> | void) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.addListener('all', listener)
    return this
  }

  /**
   * Builds all given extensions.
   * ESBuild extensions will be built using their own ESBuild context, other extensions will be built using the default
   * buildForBundle method.
   */
  private async buildExtensions(extensions: ExtensionInstance[]): Promise<ExtensionBuildResult[]> {
    const promises = extensions.map(async (ext) => {
      try {
        if (this.esbuildManager.contexts[ext.handle]) {
          const result = await this.esbuildManager.contexts[ext.handle]?.rebuild()
          if (result?.errors?.length) throw new Error(result?.errors.map((err) => err.text).join('\n'))
        } else {
          await this.buildExtension(ext)
        }
        return {status: 'ok', handle: ext.handle} as const
        // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
      } catch (error: any) {
        return {status: 'error', error: error.message, handle: ext.handle} as const
      }
    })
    const output = await Promise.all(promises)
    // For now, do nothing with the output, but we could log the errors or something
    // ESBuild errors are already logged by the ESBuild bundler
    return output
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

/**
 * When an extension folder is deleted:
 * Remove the extension from the app and return the updated app and the deleted extension in the event.
 *
 * An extension folder can contain multiple extensions, the event will include all of them.
 */
async function ExtensionFolderDeletedHandler({event, app, extensions}: HandlerInput): Promise<AppEvent> {
  const events = extensions.map((ext) => {
    app.removeExtension(ext.handle)
    return {type: EventType.Deleted, extension: ext}
  })
  return {app, extensionEvents: events, startTime: event.startTime, path: event.path}
}

/**
 * When a file is created, updated or deleted:
 * Return the same app and the updated extension(s) in the event.
 *
 * A file can be shared between multiple extensions in the same folder. The event will include all of the affected ones.
 */
async function FileChangeHandler({event, app, extensions}: HandlerInput): Promise<AppEvent> {
  const events: ExtensionEvent[] = extensions.map((ext) => ({type: EventType.Updated, extension: ext}))
  return {app, extensionEvents: events, startTime: event.startTime, path: event.path}
}

/**
 * Handler for events that requiere a full reload of the app:
 * - When a new extension folder is created
 * - When the app.toml is updated
 * - When an extension toml is updated
 */
async function ReloadAppHandler({event, app, options}: HandlerInput): Promise<AppEvent> {
  const newApp = await reloadApp(app, options)
  const diff = appDiff(app, newApp, true)
  const createdEvents = diff.created.map((ext) => ({type: EventType.Created, extension: ext}))
  const deletedEvents = diff.deleted.map((ext) => ({type: EventType.Deleted, extension: ext}))
  const updatedEvents = diff.updated.map((ext) => ({type: EventType.Updated, extension: ext}))
  const extensionEvents = [...createdEvents, ...deletedEvents, ...updatedEvents]
  return {app: newApp, extensionEvents, startTime: event.startTime, path: event.path}
}

/**
 * When the app.toml is deleted:
 * Throw an error to exit the process.
 */
async function AppConfigDeletedHandler(_input: HandlerInput): Promise<AppEvent> {
  // The user deleted the active app.toml, why would they do that? :(
  throw new AbortError('The active app.toml was deleted, exiting')
}

/*
 * Reload the app and returns it
 * Prints the time to reload the app to stdout
 */
async function reloadApp(app: AppInterface, options: OutputContextOptions): Promise<AppInterface> {
  const start = startHRTime()
  try {
    const newApp = await loadApp({
      specifications: app.specifications,
      directory: app.directory,
      userProvidedConfigName: basename(app.configuration.path),
      remoteFlags: app.remoteFlags,
    })
    outputDebug(`App reloaded [${endHRTimeInMs(start)}ms]`, options.stdout)
    return newApp
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputWarn(`Error reloading app: ${error.message}`, options.stderr)
    return app
  }
}

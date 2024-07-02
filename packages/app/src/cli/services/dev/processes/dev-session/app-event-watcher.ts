import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {AppInterface} from '../../../../models/app/app.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import micromatch from 'micromatch'

/**
 * The type of the extension event
 *
 * - Updated: The extension was updated (a file changed, but is not a source file, so it won't require a rebuild)
 * - UpdatedSourceFile: The extension was updated and a source file was changed, so it will require a rebuild
 * - Deleted: The extension was deleted
 * - Created: The extension was created
 */
export enum EventType {
  Updated,
  UpdatedSourceFile,
  Deleted,
  Created,
}

export interface ExtensionEvent {
  type: EventType
  extension: ExtensionInstance
}

export interface AppEvent {
  app: AppInterface
  extensionEvents: ExtensionEvent[]
  startTime: [number, number]
}

interface HandlerInput {
  event: WatcherEvent
  app: AppInterface
  extensions: ExtensionInstance[]
  options: OutputContextOptions
}

type Handler = (input: HandlerInput) => Promise<AppEvent>

const handlers: {[key in WatcherEvent['type']]: Handler} = {
  extension_folder_deleted: ExtensionFolderDeletedHandler,
  extension_folder_created: ExtensionFolderCreatedHandler,
  file_created: FileChangeHandler,
  file_deleted: FileChangeHandler,
  file_updated: FileChangeHandler,
  toml_updated: TomlChangeHandler,
  app_config_updated: AppConfigUpdatedHandler,
  app_config_deleted: AppConfigDeletedHandler,
}

/**
 * Subscribe to events for the given app.
 * When a change is detected, the onChange callback will be called with the event.
 * The event will include the updated app and the extension(s) affected by the change.
 *
 * This function will reload the app when necessary, the onChange callback will always have the latest app.
 * This function won't rebuild the extensions, it's the responsibility of the consumer of the event to do so.
 */
export async function subscribeToAppEvents(
  app: AppInterface,
  options: OutputContextOptions,
  onChange: (event: AppEvent) => void,
) {
  let currentApp = app
  await startFileWatcher(app, options, (event) => {
    // A file/folder can contain multiple extensions, this is the list of extensions possibly affected by the change
    const extensions = currentApp.realExtensions.filter((ext) => ext.directory === event.extensionPath)
    handlers[event.type]({event, app: currentApp, extensions, options})
      .then((appEvent) => {
        currentApp = appEvent.app
        if (appEvent.extensionEvents.length === 0) {
          options.stdout.write('Change detected, but no extensions were affected')
          return
        }
        onChange(appEvent)
      })
      .catch((error) => {
        options.stderr.write(`Error handling event: ${event.type}`)
        throw error
      })
  })
}

export function normalizeTime(time: [number, number]) {
  return (time[0] * 1000 + time[1] / 1000000).toFixed(2)
}

/**
 * When an extension folder is deleted:
 * Remove the extension from the app and return the updated app and the deleted extension in the event.
 *
 * An extension folder can contain multiple extensions, the event will include all of them.
 */
async function ExtensionFolderDeletedHandler({event, app, extensions}: HandlerInput) {
  if (extensions.length === 0) return {app, extensionEvents: [], startTime: event.startTime}
  app.realExtensions = app.realExtensions.filter((ext) => ext.directory !== event.path)
  const events = extensions.map((ext) => ({type: EventType.Deleted, extension: ext}))
  return {app, extensionEvents: events, startTime: event.startTime}
}

/**
 * When a file is created, updated or deleted:
 * Return the same app and the updated extension(s) in the event.
 * Is the responsibility of the consumer of the event to build the extension if necessary
 *
 * A file can be shared between multiple extensions in the same folder. The event will include all of the affected ones.
 */
async function FileChangeHandler({event, app, extensions}: HandlerInput) {
  const events: ExtensionEvent[] = extensions.map((ext) => {
    const buildPaths = ext.watchBuildPaths ?? []
    const type = micromatch.isMatch(event.path, buildPaths) ? EventType.UpdatedSourceFile : EventType.Updated
    return {type, extension: ext}
  })
  return {app, extensionEvents: events, startTime: event.startTime}
}

/**
 * When an extension.toml is updated:
 * Return the same app and the updated extension(s) in the event.
 * Is the responsibility of the consumer of the event to build the extension if necessary
 *
 * Since a toml can contain multiple extensions, this could trigger Create, Delete and Update events.
 * The toml is considered a SourceFile because changes in the configuration can affect the build.
 */
async function TomlChangeHandler({event, app, extensions, options}: HandlerInput) {
  const newApp = await reloadApp(app, options)
  const oldExtensions = extensions
  const oldExtensionsHandles = oldExtensions.map((ext) => ext.handle)
  const newExtensions = newApp.realExtensions.filter((ext) => ext.configurationPath === event.path)
  const newExtensionsHandles = newExtensions.map((ext) => ext.handle)

  const createdExtensions = newExtensions.filter((ext) => !oldExtensionsHandles.includes(ext.handle))
  const deletedExtensions = oldExtensions.filter((ext) => !newExtensionsHandles.includes(ext.handle))

  const updatedExtensions = newExtensions.filter((ext) => {
    const oldConfig = oldExtensions.find((oldExt) => oldExt.handle === ext.handle)?.configuration
    const newConfig = ext.configuration
    if (oldConfig === undefined) return false
    return JSON.stringify(oldConfig) !== JSON.stringify(newConfig)
  })
  const createdEvents = createdExtensions.map((ext) => ({type: EventType.Created, extension: ext}))
  const deletedEvents = deletedExtensions.map((ext) => ({type: EventType.Deleted, extension: ext}))
  const updatedEvents = updatedExtensions.map((ext) => ({type: EventType.UpdatedSourceFile, extension: ext}))
  return {
    app: newApp,
    extensionEvents: [...createdEvents, ...deletedEvents, ...updatedEvents],
    startTime: event.startTime,
  }
}

/**
 * When an extension folder is created:
 * Reload the app and return the new app and the created extensions in the event.
 */
async function ExtensionFolderCreatedHandler({event, app, options}: HandlerInput) {
  const newApp = await reloadApp(app, options)
  const oldExtensions = app.realExtensions.map((ext) => ext.handle)
  const newExtensions = newApp.realExtensions
  const createdExtensions = newExtensions.filter((ext) => !oldExtensions.includes(ext.handle))
  const events = createdExtensions.map((ext) => ({type: EventType.Created, extension: ext}))
  return {app: newApp, extensionEvents: events, startTime: event.startTime}
}

/**
 * When the app.toml is updated:
 * Reload the app and return the new app and the updated extensions in the event.
 * Compare the old and new extensions (defined in the app tomle) to find the created, deleted and updated extensions.
 */
async function AppConfigUpdatedHandler({event, app, options}: HandlerInput) {
  const newApp = await reloadApp(app, options)
  const oldExtensions = app.realExtensions.filter((ext) => ext.configurationPath === app.configuration.path)
  const oldExtensionsHandles = oldExtensions.map((ext) => ext.handle)
  const newExtensions = newApp.realExtensions.filter((ext) => ext.configurationPath === app.configuration.path)
  const newExtensionsHandles = newExtensions.map((ext) => ext.handle)

  const createdExtensions = newExtensions.filter((ext) => !oldExtensionsHandles.includes(ext.handle))
  const deletedExtensions = oldExtensions.filter((ext) => !newExtensionsHandles.includes(ext.handle))
  const updatedExtensions = newExtensions.filter((ext) => {
    const oldConfig = oldExtensions.find((oldExt) => oldExt.handle === ext.handle)?.configuration
    const newConfig = ext.configuration
    if (oldConfig === undefined) return false
    return JSON.stringify(oldConfig) !== JSON.stringify(newConfig)
  })
  const createEvents = createdExtensions.map((ext) => ({type: EventType.Created, extension: ext}))
  const deleteEvents = deletedExtensions.map((ext) => ({type: EventType.Deleted, extension: ext}))
  const updateEvents = updatedExtensions.map((ext) => ({type: EventType.Updated, extension: ext}))
  return {app: newApp, extensionEvents: [...createEvents, ...deleteEvents, ...updateEvents], startTime: event.startTime}
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
  const start = process.hrtime()
  const newApp = await loadApp({
    specifications: app.specifications,
    directory: app.directory,
    userProvidedConfigName: undefined,
    remoteFlags: app.remoteFlags,
  })
  const endTime = process.hrtime(start)
  options.stdout.write(`App reloaded [${normalizeTime(endTime)}ms]`)
  return newApp
}

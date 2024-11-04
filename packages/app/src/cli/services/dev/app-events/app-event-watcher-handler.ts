import {OutputContextOptions, WatcherEvent} from './file-watcher.js'
import {AppEvent, EventType, ExtensionEvent} from './app-event-watcher.js'
import {appDiff} from './app-diffing.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../models/app/loader.js'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {basename} from '@shopify/cli-kit/node/path'

/**
 * Transforms an array of WatcherEvents from the file system into a processed AppEvent.
 *
 * An AppEvent contains the updated App, and the list of updates that happened to the extensions. (created, deleted, updated)
 *
 * If there is an event that requires a full app reload, we first reload the app and then process the rest of the events.
 */
export async function handleWatcherEvents(
  events: WatcherEvent[],
  app: AppLinkedInterface,
  options: OutputContextOptions,
): Promise<AppEvent | undefined> {
  if (events[0] === undefined) return undefined
  const appReloadNeeded = events.some((event) => eventsThatRequireReload.includes(event.type))
  const otherEvents = events.filter((event) => !eventsThatRequireReload.includes(event.type))

  let appEvent: AppEvent = {app, extensionEvents: [], path: events[0].path, startTime: events[0].startTime}
  if (appReloadNeeded) appEvent = await ReloadAppHandler({event: events[0], app, options, extensions: []})

  for (const event of otherEvents) {
    const affectedExtensions = app.realExtensions.filter((ext) => ext.directory === event.extensionPath)
    const newEvent = handlers[event.type]({event, app: appEvent.app, extensions: affectedExtensions, options})
    appEvent.extensionEvents.push(...newEvent.extensionEvents)
  }

  return appEvent
}

type Handler = (input: HandlerInput) => AppEvent

interface HandlerInput {
  event: WatcherEvent
  app: AppLinkedInterface
  extensions: ExtensionInstance[]
  options: OutputContextOptions
}

const eventsThatRequireReload: WatcherEvent['type'][] = ['extensions_config_updated', 'extension_folder_created']

/**
 * Handlers for the different types of events that can be emitted by the file watcher.
 *
 * Each handler returns an AppEvent, which contains the updated app and the list of extensions that were affected by the event.
 *
 * Events that require a full app reload are ignored here and handled manually before calling the handlers.
 */
const handlers: {[key in WatcherEvent['type']]: Handler} = {
  extension_folder_deleted: ExtensionFolderDeletedHandler,
  file_created: FileChangeHandler,
  file_deleted: FileChangeHandler,
  file_updated: FileChangeHandler,
  app_config_deleted: AppConfigDeletedHandler,
  // These two are processed manually to avoid multiple reloads
  extension_folder_created: EmptyHandler,
  extensions_config_updated: EmptyHandler,
}

/**
 * When an extension folder is deleted:
 * Remove the extension from the app and return the updated app and the deleted extension in the event.
 *
 * An extension folder can contain multiple extensions, the event will include all of them.
 */
function ExtensionFolderDeletedHandler({event, app, extensions}: HandlerInput): AppEvent {
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
function FileChangeHandler({event, app, extensions}: HandlerInput): AppEvent {
  const events: ExtensionEvent[] = extensions.map((ext) => ({type: EventType.Updated, extension: ext}))
  return {app, extensionEvents: events, startTime: event.startTime, path: event.path}
}

/**
 * When an event doesn't require any action, return the same app and an empty event.
 */
function EmptyHandler(input: HandlerInput): AppEvent {
  return {app: input.app, extensionEvents: [], startTime: input.event.startTime, path: input.event.path}
}

/**
 * When the app.toml is deleted:
 * Throw an error to exit the process.
 */
function AppConfigDeletedHandler(_input: HandlerInput): AppEvent {
  // The user deleted the active app.toml, why would they do that? :(
  throw new AbortError('The active app.toml was deleted, exiting')
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

/*
 * Reload the app and returns it
 * Prints the time to reload the app to stdout
 */
export async function reloadApp(app: AppLinkedInterface, options: OutputContextOptions): Promise<AppLinkedInterface> {
  const start = startHRTime()
  try {
    const newApp = await loadApp({
      specifications: app.specifications,
      directory: app.directory,
      userProvidedConfigName: basename(app.configuration.path),
      remoteFlags: app.remoteFlags,
    })
    outputDebug(`App reloaded [${endHRTimeInMs(start)}ms]`, options.stdout)
    return newApp as AppLinkedInterface
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    outputWarn(`Error reloading app: ${error.message}`, options.stderr)
    return app
  }
}

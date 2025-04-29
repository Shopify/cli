import {OutputContextOptions, WatcherEvent} from './file-watcher.js'
import {AppEvent, EventType, ExtensionEvent} from './app-event-watcher.js'
import {appDiff} from './app-diffing.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {reloadApp} from '../../../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {endHRTimeInMs, startHRTime} from '@shopify/cli-kit/node/hrtime'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'

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
  outputDebug(`handleWatcherEvents received ${events.length} events: ${events.map(e => e.type).join(', ')}`)
  
  // Check for extension_folder_created events and log them specifically
  const extensionFolderCreatedEvents = events.filter(e => e.type === 'extension_folder_created');
  if (extensionFolderCreatedEvents.length > 0) {
    outputDebug(`Detected ${extensionFolderCreatedEvents.length} extension_folder_created events`)
  }
  if (events[0] === undefined) return undefined
  const appReloadNeeded = events.some((event) => eventsThatRequireReload.includes(event.type))
  const otherEvents = events.filter((event) => !eventsThatRequireReload.includes(event.type))

  if (appReloadNeeded) return ReloadAppHandler({event: events[0], app, options, extensions: []})

  const appEvent: AppEvent = {app, extensionEvents: [], path: events[0].path, startTime: events[0].startTime}

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
    app.removeExtension(ext.uid)
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
async function ReloadAppHandler({event, app}: HandlerInput): Promise<AppEvent> {
  console.log('MED MAN DEV - ReloadAppHandler called - event type:', event.type);
  
  const newApp = await reload(app)
  const diff = appDiff(app, newApp, true)
  
  // Log info about all extensions before and after reloading
  const oldFunctionExtensions = app.allExtensions.filter(ext => ext.isFunctionExtension);
  const newFunctionExtensions = newApp.allExtensions.filter(ext => ext.isFunctionExtension);
  
  console.log('MED MAN DEV - Before reload:', app.allExtensions.length, 'total extensions,', oldFunctionExtensions.length, 'functions');
  console.log('MED MAN DEV - After reload:', newApp.allExtensions.length, 'total extensions,', newFunctionExtensions.length, 'functions');
  
  outputInfo(`RELOAD: Before reload: ${app.allExtensions.length} total extensions, ${oldFunctionExtensions.length} functions`);
  outputInfo(`RELOAD: After reload: ${newApp.allExtensions.length} total extensions, ${newFunctionExtensions.length} functions`);
  
  if (newFunctionExtensions.length > oldFunctionExtensions.length) {
    const newFunctions = newFunctionExtensions.filter(newF => 
      !oldFunctionExtensions.some(oldF => oldF.uid === newF.uid)
    );
    
    const newFunctionNames = newFunctions.map(f => f.name).join(', ');
    outputInfo(`New function extensions detected after reload: ${newFunctionNames}`);
    console.log('MED MAN DEV - New functions:', newFunctionNames);
  }
  
  // Debug log all created extensions to see what's happening
  if (diff.created.length > 0) {
    outputInfo(`App reload created ${diff.created.length} extensions:`)
    console.log('MED MAN DEV - Created extensions:', diff.created.length);
    
    diff.created.forEach((ext) => {
      outputInfo(`  - ${ext.name} (${ext.type}), is function: ${ext.isFunctionExtension}`)
      console.log('MED MAN DEV - Created extension:', ext.name, 'type:', ext.type, 'is function:', ext.isFunctionExtension);
    })
  }
  
  // Check for any function extensions in created events
  const createdFunctions = diff.created.filter(ext => ext.isFunctionExtension);
  if (createdFunctions.length > 0) {
    console.log('MED MAN DEV - Created function extensions:', createdFunctions.map(f => f.name).join(', '));
    outputInfo(`Created function extensions: ${createdFunctions.map(f => f.name).join(', ')}`);
  } else {
    console.log('MED MAN DEV - No created function extensions found in diff');
  }
  
  const createdEvents = diff.created.map((ext) => ({type: EventType.Created, extension: ext}))
  const deletedEvents = diff.deleted.map((ext) => ({type: EventType.Deleted, extension: ext}))
  const updatedEvents = diff.updated.map((ext) => ({type: EventType.Updated, extension: ext}))
  let extensionEvents = [...createdEvents, ...deletedEvents, ...updatedEvents]
  
  // Workaround: Make sure we have events for all new function extensions
  if (newFunctionExtensions.length > oldFunctionExtensions.length) {
    const newFunctionIds = newFunctionExtensions.map(f => f.uid);
    const oldFunctionIds = oldFunctionExtensions.map(f => f.uid);
    const addedFunctionIds = newFunctionIds.filter(id => !oldFunctionIds.includes(id));
    
    // Add missing function extensions as created events
    const missingFunctionEvents = newFunctionExtensions
      .filter(ext => addedFunctionIds.includes(ext.uid))
      .filter(ext => !extensionEvents.some(event => 
        event.type === EventType.Created && event.extension.uid === ext.uid
      ))
      .map(ext => ({type: EventType.Created, extension: ext}));
      
    if (missingFunctionEvents.length > 0) {
      console.log('MED MAN DEV - Adding missing function events:', missingFunctionEvents.length);
      outputInfo(`Adding ${missingFunctionEvents.length} missing function events that were not detected by diffing`);
      extensionEvents = [...extensionEvents, ...missingFunctionEvents];
    }
  }
  
  return {app: newApp, extensionEvents, startTime: event.startTime, path: event.path, appWasReloaded: true}
}

/*
 * Reload the app and returns it
 * Prints the time to reload the app to stdout
 */
async function reload(app: AppLinkedInterface): Promise<AppLinkedInterface> {
  const start = startHRTime()
  try {
    const newApp = await reloadApp(app)
    outputDebug(`App reloaded [${endHRTimeInMs(start)}ms]`)
    return newApp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(`Error reloading app: ${error.message}`, {cause: 'validation-error'})
  }
}

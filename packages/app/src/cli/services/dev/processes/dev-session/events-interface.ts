import {OutputContextOptions, WatcherEvent, startFileWatcher} from './file-watcher.js'
import {AppInterface} from '../../../../models/app/app.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {loadApp} from '../../../../models/app/loader.js'
import {AbortError} from '@shopify/cli-kit/node/error'

interface ExtensionEvent {
  type: 'updated' | 'deleted' | 'created'
  extension: ExtensionInstance
}

interface AppEvent {
  app: AppInterface
  extensionEvents: ExtensionEvent[]
}

// TomlFileChangeHandler {
//   (file) => {
//       return ExtensionEvents[]
//     }
//   }
// }

// Watcher(infra) => TomlFileChangedEvent      => ExtensionEvents
//                => FunctionFileChangedEvent  => ExtensionEvents
//                => NewExtensionEvent (reloadApp) =>
//                => ExtensionChangeEvent (reloadsExtension) => ExtensionEvents
interface HandlerInput {
  event: WatcherEvent
  app: AppInterface
  extensions: ExtensionInstance[]
}

type Handler = (input: HandlerInput) => Promise<AppEvent>

const handlers: {[key in WatcherEvent['type']]: Handler} = {
  extension_folder_deleted: ExtensionFolderDeletedHandler,
  extension_folder_created: ExtensionFolderCreatedHandler,
  file_created: FileChangeHandler,
  file_deleted: FileChangeHandler,
  file_updated: FileChangeHandler,
  app_config_updated: AppConfigUpdatedHandler,
  app_config_deleted: AppConfigDeletedHandler,
}

export async function subscribeToAppEvents(
  app: AppInterface,
  options: OutputContextOptions,
  onChange: (event: AppEvent) => void,
) {
  let currentApp = app
  await startFileWatcher(app, options, (event) => {
    // A file/folder can contain multiple extensions, this is the list of extensions possibly affected by the change
    const extensions = currentApp.realExtensions.filter((ext) => ext.directory === event.extensionPath)

    handlers[event.type]({event, app: currentApp, extensions})
      .then((appEvent) => {
        currentApp = appEvent.app
        onChange(appEvent)
      })
      .catch((error) => {
        options.stderr.write(`Error handling event: ${event.type}`)
        throw error
      })
  })
}

async function ExtensionFolderDeletedHandler({event, app, extensions}: HandlerInput) {
  if (extensions.length === 0) return {app, extensionEvents: []}
  app.realExtensions = app.realExtensions.filter((ext) => ext.directory !== event.path)
  const events = extensions.map((ext) => ({type: 'deleted', extension: ext})) as ExtensionEvent[]
  return {app, extensionEvents: events}
}

async function FileChangeHandler({app, extensions}: HandlerInput) {
  // PENDING: Build the extensions if necessary
  extensions.forEach((ext) => {
    // ext.buildForBundle({app, environment: 'development'}, app.directory, undefined)
  })
  const events = extensions.map((ext) => ({type: 'updated', extension: ext})) as ExtensionEvent[]
  return {app, extensionEvents: events}
}

async function ExtensionFolderCreatedHandler({app}: HandlerInput) {
  console.log('New extension, reloading app...')
  // We need to reload the app
  const newApp = await reloadApp(app)
  const oldExtensions = app.realExtensions.map((ext) => ext.handle)
  const newExtensions = newApp.realExtensions
  const createdExtensions = newExtensions.filter((ext) => !oldExtensions.includes(ext.handle))
  const events = createdExtensions.map((ext) => ({type: 'created', extension: ext})) as ExtensionEvent[]
  // const events = extensions.map((ext) => ({type: 'created', extension: ext})) as ExtensionEvent[]
  // PENDING: Try to detect which extensions were created here
  // PENDING: Build the extensions if necessary
  return {app: newApp, extensionEvents: events}
}

async function AppConfigUpdatedHandler({app}: HandlerInput) {
  const newApp = await reloadApp(app)
  // PENDING: Try to detect which extensions were created, deleted or updated here
  // PENDING: Build extensions if necessary
  return {app: newApp, extensionEvents: []}
}

async function AppConfigDeletedHandler(_input: HandlerInput) {
  // The user deleted the active app.toml, why would they do that? :(
  throw new AbortError('The active app.toml was deleted, exiting')
}

async function reloadApp(app: AppInterface): Promise<AppInterface> {
  return loadApp({
    specifications: app.specifications,
    directory: app.directory,
    userProvidedConfigName: undefined,
    remoteFlags: app.remoteFlags,
  })
}

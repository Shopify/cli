/* eslint-disable no-case-declarations */
import {OutputContextOptions, WatcherEvent, startFileWatcher} from './dev-session/file-watcher.js'
import {AppInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {loadApp} from '../../../models/app/loader.js'

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

type Handler = (
  event: WatcherEvent,
  app: AppInterface,
  extensions: ExtensionInstance[],
  onChange: (event: AppEvent) => void,
) => Promise<void>

const handlers: Record<WatcherEvent['type'], Handler> = {
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
  await startFileWatcher(app, options, (event) => {
    // A file/folder can contain multiple extensions, this is the list of extensions possibly affected by the change
    const extensions = app.realExtensions.filter((ext) => ext.directory === event.extensionPath)
    handlers[event.type](event, app, extensions, onChange)
  })
}

async function ExtensionFolderDeletedHandler(
  event: WatcherEvent,
  app: AppInterface,
  extensions: ExtensionInstance[],
  onChange: (event: AppEvent) => void,
) {
  if (extensions.length === 0) return
  app.realExtensions = app.realExtensions.filter((ext) => ext.directory !== event.path)
  const events = extensions.map((ext) => ({type: 'deleted', extension: ext})) as ExtensionEvent[]
  onChange({app, extensionEvents: events})
}

async function FileChangeHandler(
  event: WatcherEvent,
  app: AppInterface,
  extensions: ExtensionInstance[],
  onChange: (event: AppEvent) => void,
) {
  // Decide if we need to re-build the extensions
  const events = extensions.map((ext) => ({type: 'updated', extension: ext})) as ExtensionEvent[]
  onChange({app, extensionEvents: events})
}

async function ExtensionFolderCreatedHandler(
  event: WatcherEvent,
  app: AppInterface,
  extensions: ExtensionInstance[],
  onChange: (event: AppEvent) => void,
) {
  // We need to reload the app
  const newApp = await reloadApp(app)
  // const events = extensions.map((ext) => ({type: 'created', extension: ext})) as ExtensionEvent[]
  // TODO: Try to detect which extensions were created here
  onChange({app: newApp, extensionEvents: []})
}

async function AppConfigUpdatedHandler(
  event: WatcherEvent,
  app: AppInterface,
  extensions: ExtensionInstance[],
  onChange: (event: AppEvent) => void,
) {
  const newApp = await reloadApp(app)
  // TODO: Try to detect which extensions were created, deleted or updated here
  onChange({app: newApp, extensionEvents: []})
}

async function AppConfigDeletedHandler() {
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

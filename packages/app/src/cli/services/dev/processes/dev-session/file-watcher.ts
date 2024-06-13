import {AppInterface} from '../../../../models/app/app.js'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {debounce} from '@shopify/cli-kit/common/function'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

/**
 * Event emitted by the file watcher
 *
 * Includes the type of the event, the path of the file that triggered the event and the extension path that contains the file.
 * path and extensionPath could be the same if the event is at the extension level (create, delete extension)
 *
 * extensionPath will be "unknown" for changes in the app config file.
 *
 * @typeParam type - The type of the event
 * @typeParam path - The path of the file that triggered the event
 * @typeParam extensionPath - The path of the extension that contains the file
 */
export interface WatcherEvent {
  type:
    | 'extension_folder_created'
    | 'extension_folder_deleted'
    | 'file_created'
    | 'file_updated'
    | 'file_deleted'
    | 'app_config_updated'
    | 'app_config_deleted'
  path: string
  extensionPath: string
}

export interface OutputContextOptions {
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

/**
 * Watch for changes in the given app.
 *
 * It will watch for changes in the active app config and the extensions directories.
 * When possible, changes will be interpreted to detect new/deleted extensions
 *
 * @param app - The app to watch
 * @param options - The output options
 * @param onChange - The callback to call when a change is detected
 */
export async function startFileWatcher(
  app: AppInterface,
  options: OutputContextOptions,
  onChange: (events: WatcherEvent) => void,
) {
  const {default: chokidar} = await import('chokidar')

  const appConfigurationPath = app.configuration.path
  const extensionDirectories = [...(app.configuration.extension_directories ?? ['extensions'])].map((directory) => {
    return joinPath(app.directory, directory)
  })

  // All existing extension paths sorted by length. This allows us to use `startsWith` to find the extension
  // that was changed while avoiding false positives.
  const extensionPaths = app.realExtensions
    .map((ext) => ext.directory)
    .filter((dir) => dir !== app.directory)
    .sort((extA, extB) => extB.length - extA.length)

  // Watch the extensions root folder and the app configuration file, nothing else.
  const watchPaths = [appConfigurationPath, ...extensionDirectories]

  // Create a debouncer for each extension directory to avoid multiple events for the same extension
  const debouncers = new Map<string, (event: WatcherEvent) => void>()
  extensionPaths.forEach((path) => {
    debouncers.set(path, debounce(onChange, 500))
  })

  const watcher = chokidar.watch(watchPaths, {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**'],
    persistent: true,
    ignoreInitial: true,
  })

  console.log('Watcher ready!')

  watcher.on('all', (event, path) => {
    const isConfigAppPath = path === appConfigurationPath
    const isRootExtensionDirectory = extensionDirectories.some((dir) => dirname(path) === dir)
    const extensionPath = extensionPaths.find((dir) => path.startsWith(dir)) ?? 'unknown'

    if (extensionPath === 'unknown' && !isConfigAppPath) {
      // Change in a folder that is not in the list of extensions -> it could be an extension being created. ignore.
      return
    }

    const extensionDebouncedChange = debouncers.get(extensionPath)

    // We need to debounce events of type add, addDir, unlink, unlinkDir to avoid multiple events for the same extension
    // When adding/deleting an extension, we get multiple events for the same extension
    switch (event) {
      case 'change':
        onChange({type: isConfigAppPath ? 'app_config_updated' : 'file_updated', path, extensionPath})
        break
      case 'add':
        // This event will be ignored for new extensions until the extension is added to `extensionPaths`.
        onChange({type: 'file_created', path, extensionPath})
        break
      case 'addDir':
        // Adding a root folder of a extension triggers a 'extension_folder_created'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // Wait 5 seconds to report the new extension to give time to the extension to be created
        setTimeout(() => {
          onChange({type: 'extension_folder_created', path, extensionPath})
          extensionPaths.push(path)
        }, 5000)
        break
      case 'unlink':
        if (isConfigAppPath) {
          onChange({type: 'app_config_deleted', path, extensionPath})
        } else {
          // When deleting a file, debounce the event to avoid multiple events for the same extension
          // Ultimately, multiple deletion events could mean that the extension is being deleted
          extensionDebouncedChange?.({type: 'file_deleted', path, extensionPath})
        }
        break
      case 'unlinkDir':
        // Deleting the root folder of a extension triggers a 'extension_folder_deleted'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // 'unlink'  and 'unlinkDir' use the same debouncer, when deleting an extension, the last event will always
        // be a deletion of the root directory, so that's the last (and only) event we need to trigger.
        extensionDebouncedChange?.({type: 'extension_folder_deleted', path, extensionPath})
        debouncers.delete(path)
        break
    }
  })
  listenForAbortOnWatchera(watcher, options)
}

const listenForAbortOnWatchera = (watcher: FSWatcher, options: OutputContextOptions) => {
  options.signal.addEventListener('abort', () => {
    outputDebug(`Closing file watcher`, options.stdout)
    watcher
      .close()
      .then(() => outputDebug(`File watching closed`, options.stdout))
      .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, options.stderr))
  })
}

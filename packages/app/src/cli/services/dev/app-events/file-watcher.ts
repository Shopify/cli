import {AppInterface} from '../../../models/app/app.js'
import {dirname, isSubpath, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {debounce} from '@shopify/cli-kit/common/function'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
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
 * @typeParam startTime - The time when the event was triggered
 */
export interface WatcherEvent {
  type:
    | 'extension_folder_created'
    | 'extension_folder_deleted'
    | 'file_created'
    | 'file_updated'
    | 'file_deleted'
    | 'toml_updated'
    | 'app_config_updated'
    | 'app_config_deleted'
  path: string
  extensionPath: string
  startTime: [number, number]
}

export interface OutputContextOptions {
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

/**
 * Watch for changes in the given app directory.
 *
 * It will watch for changes in the active config file and the extension directories.
 * When possible, changes will be interpreted to detect new/deleted extensions
 *
 * Changes to toml files will be reported as different events to other file changes.
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

  // Current active extension paths (not defined in the main app configuration file)
  // If a change happens outside of these paths, it will be ignored unless is for a new extension being created
  // When a new extension is created, the path is added to this list
  // When an extension is deleted, the path is removed from this list
  // For every change, the corresponding extensionPath will be also reported in the event
  const extensionPaths = app.realExtensions
    .map((ext) => normalizePath(ext.directory))
    .filter((dir) => dir !== app.directory)

  // Watch the extensions root directories and the app configuration file, nothing else.
  const watchPaths = [appConfigurationPath, ...extensionDirectories]

  // Create a debouncer for each extension directory to avoid multiple events for the same extension
  // This is necessary because deleting/creating a folder will trigger multiple events, but we only need one.
  const debouncers = new Map<string, (event: WatcherEvent) => void>()
  extensionPaths.forEach((path) => {
    debouncers.set(path, debounce(onChange, 500))
  })

  // When a new extension path is detected (new extension folder added), add it to the list of known paths
  // And create a debouncer for it
  function registerNewExtensionPath(path: string) {
    extensionPaths.push(path)
    debouncers.set(path, debounce(onChange, 500))
  }

  // When an extension path is deleted (extension folder deleted), remove it from the list of known paths
  // And remove its debouncer
  function removeExtensionPath(path: string) {
    extensionPaths.splice(extensionPaths.indexOf(path), 1)
    debouncers.delete(path)
  }

  // Create watcher ignoring node_modules, git, test files and dist folders
  const watcher = chokidar.watch(watchPaths, {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**'],
    persistent: true,
    ignoreInitial: true,
  })

  // Start watcher for 'all' events
  watcher.on('all', (event, path) => {
    const startTime = process.hrtime()
    const isConfigAppPath = path === appConfigurationPath
    const isRootExtensionDirectory = extensionDirectories.some((dir) => dirname(path) === dir)
    const extensionPath = extensionPaths.find((dir) => isSubpath(dir, path)) ?? 'unknown'

    if (extensionPath === 'unknown' && !isConfigAppPath && !isRootExtensionDirectory) {
      // Ignore an event if: it's not part of an existing extension AND it's not the app config file or an extension root directory
      return
    }

    // Debouncer for the detected extension path
    const extensionDebouncedChange = debouncers.get(extensionPath)

    switch (event) {
      case 'change':
        if (isConfigAppPath) {
          onChange({type: 'app_config_updated', path, extensionPath, startTime})
        } else if (path.endsWith('.toml')) {
          onChange({type: 'toml_updated', path, extensionPath, startTime})
        } else {
          onChange({type: 'file_updated', path, extensionPath, startTime})
        }
        break
      case 'add':
        // This event will be triggered multiple times when adding a new extension.
        // It will be ignored until the `addDir` event completes and adds the new extension to the known list.
        onChange({type: 'file_created', path, extensionPath, startTime})
        break
      case 'addDir':
        // Adding a root folder of a extension triggers a 'extension_folder_created'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // Wait 5 seconds to report the new extension to give time to the extension to be created
        setTimeout(
          () => {
            onChange({type: 'extension_folder_created', path, extensionPath, startTime})
            registerNewExtensionPath(path)
          },
          isUnitTest() ? 500 : 5000,
        )
        break
      case 'unlink':
        if (isConfigAppPath) {
          onChange({type: 'app_config_deleted', path, extensionPath, startTime})
        } else {
          // When deleting a file, debounce the event to avoid multiple events for the same extension
          // Ultimately, multiple deletion events could mean that the extension is being deleted
          extensionDebouncedChange?.({type: 'file_deleted', path, extensionPath, startTime})
        }
        break
      case 'unlinkDir':
        // Deleting the root folder of a extension triggers a 'extension_folder_deleted'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // 'unlink'  and 'unlinkDir' use the same debouncer, when deleting an extension, the last event will always
        // be a deletion of the root directory, so that's the last (and only) event we need to trigger.
        extensionDebouncedChange?.({type: 'extension_folder_deleted', path, extensionPath, startTime})
        removeExtensionPath(path)
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

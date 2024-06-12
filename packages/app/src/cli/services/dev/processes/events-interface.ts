import {AppInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {FSWatcher} from 'chokidar'
import * as pathActions from '@shopify/cli-kit/node/path'
import {debounce} from '@shopify/cli-kit/common/function'
import {Writable} from 'stream'

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

function subscribeToAppEvents(app: AppInterface, handler: (event: AppEvent) => void) {
  // ...
}

interface WatcherEvent {
  type:
    | 'extension_folder_created'
    | 'extension_folder_deleted'
    | 'file_created'
    | 'file_updated'
    | 'file_deleted'
    | 'app_config_updated'
    | 'app_config_deleted'
  path: string
}

export async function startFileWatcher(app: AppInterface, onChange: (events: WatcherEvent) => void) {
  const {default: chokidar} = await import('chokidar')
  const appConfigurationPath = app.configuration.path

  // Watch the extensions folder and the app configuration file, nothing else.
  const extensionDirectories = [...(app.configuration.extension_directories ?? ['extensions'])].map((directory) => {
    return joinPath(app.directory, directory)
  })

  // All existing extension paths sorted by length.
  // Sorting by length allows us to use `startsWith` to find the extension that was changed
  // while avoiding false positives.
  const extensionPaths = app.realExtensions
    .map((ext) => ext.directory)
    .filter((dir) => dir !== app.directory)
    .sort((extA, extB) => extB.length - extA.length)
  // const extensionWatcherPaths = extensionDirectories // .map((extension) => joinPath(extension, '**/*'))
  const watchPaths = [appConfigurationPath, ...extensionDirectories]

  console.log(extensionPaths)
  console.log(watchPaths)

  // Ignore changes in node_modules, git, dist, and test files.
  const ignored = ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**']

  const debouncers = new Map<string, (event: WatcherEvent) => void>()
  extensionPaths.forEach((path) => {
    debouncers.set(path, debounce(onChange, 500))
  })

  const watcher = chokidar.watch(watchPaths, {
    ignored,
    persistent: true,
    ignoreInitial: true,
  })

  console.log('Watcher ready!')

  watcher.on('all', (event, path) => {
    // console.log(event, path)
    const isConfigAppPath = path === appConfigurationPath
    const isRootExtensionDirectory = extensionDirectories.some((dir) => pathActions.dirname(path) === dir)
    const extensionRootDirectory = extensionPaths.find((dir) => path.startsWith(dir)) ?? 'unknown'

    if (extensionRootDirectory === 'unknown' && !isConfigAppPath) {
      // Change detected in a folder that is not in the list of extensions -> it could be an extension being created
      // We should ignore these changes.
      console.log('Detected change in UNKNOWN path: ', path)
      return
    }

    console.log('Detected change in', extensionRootDirectory)
    const extensionDebouncedChange = debouncers.get(extensionRootDirectory)

    // We need to debounce events of type add, addDir, unlink, unlinkDir to avoid multiple events for the same extension
    // When adding/deleting an extension, we get multiple events for the same extension
    switch (event) {
      case 'change':
        if (path === appConfigurationPath) {
          onChange({type: 'app_config_updated', path})
        } else {
          onChange({type: 'file_updated', path})
        }
        // Updated a file, could be ExtensionChange if it happened inside an extension directory or app configuration file
        break
      case 'add':
        // Added new file, could be ExtensionChange if it happened inside an extension directory
        onChange({type: 'file_created', path})
        break
      case 'addDir':
        // Adding a root folder of a extension triggers a 'extension_folder_created'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // Wait 5 seconds to report the new extension to give time to the extension to be created
        setTimeout(() => {
          onChange({type: 'extension_folder_created', path})
          extensionPaths.push(path)
        }, 5000)
        break
      case 'unlink':
        if (path === appConfigurationPath) {
          onChange({type: 'app_config_deleted', path})
        } else {
          // When deleting a file, debounce the event to avoid multiple events for the same extension
          // Ultimately, multiple deletion events could mean that the extension is being deleted
          extensionDebouncedChange?.({type: 'file_deleted', path})
        }
        break
      case 'unlinkDir':
        // Deleting the root folder of a extension triggers a 'extension_folder_deleted'
        // Any other folder shouldn't trigger anything, if there are files inside the folder, they will trigger their own events
        if (!isRootExtensionDirectory) break
        // 'unlink'  and 'unlinkDir' use the same debouncer, when deleting an extension, the last event will always
        // be a deletion of the root directory, so that's the last (and only) event we need to trigger.
        extensionDebouncedChange?.({type: 'extension_folder_deleted', path})
        debouncers.delete(path)
        break
    }
  })
  // listenForAbortOnWatchera(signal, functionRebuildAndRedeployWatcher, stdout, stderr)
}

const listenForAbortOnWatchera = (signal: AbortSignal, watcher: FSWatcher, stdout: Writable, stderr: Writable) => {
  signal.addEventListener('abort', () => {
    outputDebug(`Closing file watcher`, stdout)
    watcher
      .close()
      .then(() => {
        outputDebug(`File watching closed`, stdout)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((error: any) => {
        outputDebug(`File watching failed to close: ${error.message}`, stderr)
      })
  })
}

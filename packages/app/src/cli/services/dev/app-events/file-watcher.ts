/* eslint-disable no-case-declarations */
import {AppInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, isSubpath, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync} from '@shopify/cli-kit/node/fs'
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
  let extensionPaths = app.realExtensions
    .map((ext) => normalizePath(ext.directory))
    .filter((dir) => dir !== app.directory)

  // Watch the extensions root directories and the app configuration file, nothing else.
  const watchPaths = [appConfigurationPath, ...extensionDirectories]

  // Create watcher ignoring node_modules, git, test files, dist folders, vim swap files
  const watcher = chokidar.watch(watchPaths, {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**', '**/*.swp'],
    persistent: true,
    ignoreInitial: true,
  })

  // Start chokidar watcher for 'all' events
  watcher.on('all', (event, path) => {
    const startTime = startHRTime()
    const isConfigAppPath = path === appConfigurationPath
    const isRootExtensionDirectory = extensionDirectories.some((dir) => dirname(path) === dir)
    const extensionPath = extensionPaths.find((dir) => isSubpath(dir, path)) ?? 'unknown'

    outputDebug(`🌀: ${event} ${path.replace(app.directory, '')}\n`)

    if (extensionPath === 'unknown' && !isConfigAppPath && !isRootExtensionDirectory) {
      // Ignore an event if: it's not part of an existing extension AND it's not the app config file or an extension root directory

      // But, if it's a toml being modified/added in an unknown path, we should still trigger a `toml_updated` event.
      // This covers the case where a user accidentally deletes a toml and re-adds it again.
      // And it will force an app reload.
      // if (path.endsWith('.toml') && !fileExistsSync(joinPath(dirname(path), configurationFileNames.app))) {
      //   onChange({type: 'toml_updated', path, extensionPath, startTime})
      // }
      return
    }

    // NOTE: Handle the case where a user deletes a toml file and immediatelly adds it again.
    // Right now we trigger the extension deletion, but not the subsequent creation.

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
        // When a new extension is created, a `.shoplock` file is added first, indicating that the extension is being created
        // and it's not ready to be used yet. This file will be removed when the extension is fully created.
        // Once the file no longer exists, then we can trigger the extension_folder_created event.

        // A timeout is added just in case something goes wrong, currently set at 20 seconds.
        let totalWaitedTime = 0

        const intervalId = setInterval(() => {
          // eslint-disable-next-line no-negated-condition
          if (!fileExistsSync(joinPath(path, configurationFileNames.lockFile))) {
            clearInterval(intervalId)
            extensionPaths.push(path)
            onChange({type: 'extension_folder_created', path, extensionPath, startTime})
          } else {
            outputDebug(`Waiting for extension to complete creation: ${path}\n`)
            totalWaitedTime += 500
          }
          if (totalWaitedTime >= 20000) {
            clearInterval(intervalId)
            options.stderr.write(`Extension creation detection timeout at path: ${path}\nYou might need to restart dev`)
          }
        }, 200)
        break
      case 'unlink':
        // Ignore shoplock files
        if (path.endsWith(configurationFileNames.lockFile)) break

        if (isConfigAppPath) {
          onChange({type: 'app_config_deleted', path, extensionPath, startTime})
        } else if (path.endsWith('.toml')) {
          // When a toml is deleted, we can consider the extension is being deleted
          const newPaths = extensionPaths.filter((extPath) => extPath !== extensionPath)
          extensionPaths = newPaths
          onChange({type: 'extension_folder_deleted', path, extensionPath, startTime})
        } else {
          // wait 500ms, if there is no toml file, then the extension is being deleted and we should ignore this event.
          setTimeout(() => {
            // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
            if (!extensionPaths.includes(extensionPath)) return
            // If after 500ms the toml file is still there, then just this file was deleted and we should trigger the event.
            if (fileExistsSync(joinPath(extensionPath, 'shopify.extension.toml'))) {
              onChange({type: 'file_deleted', path, extensionPath, startTime})
            }
          }, 500)
        }
        break
      case 'unlinkDir':
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

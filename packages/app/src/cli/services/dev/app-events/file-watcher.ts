/* eslint-disable no-case-declarations */
import {AppInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, isSubpath, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, readFileSync} from '@shopify/cli-kit/node/fs'
import {Writable} from 'stream'

/**
 * Event emitted by the file watcher
 *
 * Includes the type of the event, the path of the file that triggered the event and the extension path that contains the file.
 * path and extensionPath could be the same if the event is at the extension level (create, delete extension)
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
    | 'extensions_config_updated'
    | 'app_config_deleted'
  path: string
  extensionPath: string
  startTime: StartTime
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

  // Read .gitignore files from extension directories and add the patterns to the ignored list
  const customGitIgnoredPatterns = extensionPaths
    .map((dir) => {
      const gitIgnorePath = joinPath(dir, '.gitignore')
      if (!fileExistsSync(gitIgnorePath)) return []
      const gitIgnoreContent = readFileSync(gitIgnorePath).toString()
      return gitIgnoreContent
        .split('\n')
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern !== '' && !pattern.startsWith('#'))
        .map((pattern) => joinPath(dir, pattern))
    })
    .flat()

  // Create watcher ignoring node_modules, git, test files, dist folders, vim swap files
  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/*.test.*',
      '**/dist/**',
      '**/*.swp',
      '**/generated/**',
      ...customGitIgnoredPatterns,
    ],
    persistent: true,
    ignoreInitial: true,
  })

  // Start chokidar watcher for 'all' events
  watcher.on('all', (event, path) => {
    const startTime = startHRTime()
    const isConfigAppPath = path === appConfigurationPath
    const extensionPath =
      extensionPaths.find((dir) => isSubpath(dir, path)) ?? (isConfigAppPath ? app.directory : 'unknown')
    const isToml = path.endsWith('.toml')

    outputDebug(`🌀: ${event} ${path.replace(app.directory, '')}\n`)

    if (extensionPath === 'unknown' && !isToml) {
      // Ignore an event if it's not part of an existing extension
      // Except if it is a toml file (either app config or extension config)
      return
    }

    switch (event) {
      case 'change':
        if (isToml) {
          onChange({type: 'extensions_config_updated', path, extensionPath, startTime})
        } else {
          onChange({type: 'file_updated', path, extensionPath, startTime})
        }
        break
      case 'add':
        // If it's a normal non-toml file, just report a file_created event.
        // If a toml file was added, a new extension(s) is being created.
        // We need to wait for the lock file to disappear before triggering the event.
        if (!isToml) {
          onChange({type: 'file_created', path, extensionPath, startTime})
          break
        }
        let totalWaitedTime = 0
        const realPath = dirname(path)
        const intervalId = setInterval(() => {
          if (fileExistsSync(joinPath(realPath, configurationFileNames.lockFile))) {
            outputDebug(`Waiting for extension to complete creation: ${path}\n`)
            totalWaitedTime += 500
          } else {
            clearInterval(intervalId)
            extensionPaths.push(realPath)
            onChange({type: 'extension_folder_created', path: realPath, extensionPath, startTime})
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
        } else if (isToml) {
          // When a toml is deleted, we can consider every extension in that folder was deleted.
          extensionPaths = extensionPaths.filter((extPath) => extPath !== extensionPath)
          onChange({type: 'extension_folder_deleted', path: extensionPath, extensionPath, startTime})
        } else {
          // This could be an extension delete event, Wait 500ms to see if the toml is deleted or not.
          setTimeout(() => {
            // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
            if (!extensionPaths.includes(extensionPath)) return
            onChange({type: 'file_deleted', path, extensionPath, startTime})
          }, 500)
        }
        break
      // These events are ignored
      case 'addDir':
      case 'unlinkDir':
        break
    }
  })

  listenForAbortOnWatcher(watcher, options)
}

const listenForAbortOnWatcher = (watcher: FSWatcher, options: OutputContextOptions) => {
  options.signal.addEventListener('abort', () => {
    outputDebug(`Closing file watcher`, options.stdout)
    watcher
      .close()
      .then(() => outputDebug(`File watching closed`, options.stdout))
      .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, options.stderr))
  })
}

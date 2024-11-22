/* eslint-disable no-case-declarations */
import {AppLinkedInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, isSubpath, joinPath, normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, readFileSync} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
import ignore from 'ignore'
import {Writable} from 'stream'

const EXTENSION_CREATION_TIMEOUT_IN_MS = 60000
const EXTENSION_CREATION_WAIT_INTERVAL_IN_MS = 500
const DEFAULT_DEBOUNCE_TIME_IN_MS = 200

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

export class FileWatcher {
  private readonly onChange: (events: WatcherEvent[]) => void
  private readonly options: OutputContextOptions
  private readonly debouncedEmit: () => void
  private app: AppLinkedInterface
  private currentEvents: WatcherEvent[] = []
  private ignored: {[key: string]: ignore.Ignore | undefined} = {}
  private extensionPaths: string[] = []

  constructor(
    app: AppLinkedInterface,
    options: OutputContextOptions,
    onChange: (events: WatcherEvent[]) => void,
    debounceTime = DEFAULT_DEBOUNCE_TIME_IN_MS,
  ) {
    this.app = app
    this.onChange = onChange
    this.options = options

    /**
     * Debounced function to emit the accumulated events.
     * This function will be called at most once every 500ms to avoid emitting too many events in a short period.
     */
    this.debouncedEmit = debounce(this.emitEvents.bind(this), debounceTime)
    this.updateApp(app)
  }

  updateApp(app: AppLinkedInterface) {
    this.app = app
    this.extensionPaths = this.app.realExtensions
      .map((ext) => normalizePath(ext.directory))
      .filter((dir) => dir !== this.app.directory)
    for (const path of this.extensionPaths) {
      if (this.ignored[path]) continue
      this.ignored[path] = this.createIgnoreInstance(path)
    }
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
  async start() {
    const {default: chokidar} = await import('chokidar')

    const appConfigurationPath = this.app.configuration.path
    const extensionDirectories = [...(this.app.configuration.extension_directories ?? ['extensions'])].map(
      (directory) => {
        return joinPath(this.app.directory, directory)
      },
    )

    // Watch the extensions root directories and the app configuration file, nothing else.
    const watchPaths = [appConfigurationPath, ...extensionDirectories]

    // Read .gitignore files from extension directories and add the patterns to the ignored list

    // Create watcher ignoring node_modules, git, test files, dist folders, vim swap files
    // PENDING: Use .gitgnore from app and extensions to ignore files.
    const watcher = chokidar.watch(watchPaths, {
      ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**', '**/*.swp', '**/generated/**'],
      persistent: true,
      ignoreInitial: true,
    })

    // Start chokidar watcher for 'all' events
    watcher.on('all', (event, path) => {
      const startTime = startHRTime()
      const isConfigAppPath = path === appConfigurationPath
      const extensionPath =
        this.extensionPaths.find((dir) => isSubpath(dir, path)) ?? (isConfigAppPath ? this.app.directory : 'unknown')
      const isExtensionToml = path.endsWith('.extension.toml')
      const isUnknownExtension = extensionPath === 'unknown'

      outputDebug(`🌀: ${event} ${path.replace(this.app.directory, '')}\n`)

      if (isUnknownExtension && !isExtensionToml && !isConfigAppPath) {
        // Ignore an event if it's not part of an existing extension
        // Except if it is a toml file (either app config or extension config)
        return
      }

      switch (event) {
        case 'change':
          if (isUnknownExtension) {
            // If the extension path is unknown, it means the extension was just created.
            // We need to wait for the lock file to disappear before triggering the event.
            return
          }
          if (isExtensionToml || isConfigAppPath) {
            this.pushEvent({type: 'extensions_config_updated', path, extensionPath, startTime})
          } else {
            this.pushEvent({type: 'file_updated', path, extensionPath, startTime})
          }
          break
        case 'add':
          // If it's a normal non-toml file, just report a file_created event.
          // If a toml file was added, a new extension(s) is being created.
          // We need to wait for the lock file to disappear before triggering the event.
          if (!isExtensionToml) {
            this.pushEvent({type: 'file_created', path, extensionPath, startTime})
            break
          }
          let totalWaitedTime = 0
          const realPath = dirname(path)
          const intervalId = setInterval(() => {
            if (fileExistsSync(joinPath(realPath, configurationFileNames.lockFile))) {
              outputDebug(`Waiting for extension to complete creation: ${path}\n`)
              totalWaitedTime += EXTENSION_CREATION_WAIT_INTERVAL_IN_MS
            } else {
              clearInterval(intervalId)
              this.extensionPaths.push(realPath)
              this.pushEvent({type: 'extension_folder_created', path: realPath, extensionPath, startTime})
            }
            if (totalWaitedTime >= EXTENSION_CREATION_TIMEOUT_IN_MS) {
              clearInterval(intervalId)
              this.options.stderr.write(`Error loading new extension at path: ${path}.\n Please restart the process.`)
            }
          }, EXTENSION_CREATION_WAIT_INTERVAL_IN_MS)
          break
        case 'unlink':
          // Ignore shoplock files
          if (path.endsWith(configurationFileNames.lockFile)) break

          if (isConfigAppPath) {
            this.pushEvent({type: 'app_config_deleted', path, extensionPath, startTime})
          } else if (isExtensionToml) {
            // When a toml is deleted, we can consider every extension in that folder was deleted.
            this.extensionPaths = this.extensionPaths.filter((extPath) => extPath !== extensionPath)
            this.pushEvent({type: 'extension_folder_deleted', path: extensionPath, extensionPath, startTime})
          } else {
            // This could be an extension delete event, Wait 500ms to see if the toml is deleted or not.
            setTimeout(() => {
              // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
              if (!this.extensionPaths.includes(extensionPath)) return
              this.pushEvent({type: 'file_deleted', path, extensionPath, startTime})
            }, 500)
          }
          break
        // These events are ignored
        case 'addDir':
        case 'unlinkDir':
          break
      }
    })

    this.listenForAbortOnWatcher(watcher)
  }

  /**
   * Emits the accumulated events and resets the current events list.
   * It also logs the number of events emitted and their paths for debugging purposes.
   */
  emitEvents() {
    const events = this.currentEvents
    this.currentEvents = []
    const message = `🔉 ${events.length} EVENTS EMITTED in files: ${events.map((event) => event.path).join('\n')}`
    outputDebug(message, this.options.stdout)
    this.onChange(events)
  }

  /**
   * Adds a new event to the current events list and schedules the debounced emit function.
   * If the event is already in the list, it will not be added again.
   *
   * @param event - The event to be added
   */
  pushEvent(event: WatcherEvent) {
    const extension = this.app.realExtensions.find((ext) => ext.directory === event.extensionPath)
    const watchPaths = extension?.devSessionWatchPaths
    // If the affected extension defines custom watch paths, ignore the event if it's not in the list
    if (watchPaths) {
      const isAValidWatchedPath = watchPaths.some((pattern) => matchGlob(event.path, pattern))
      if (!isAValidWatchedPath) return
    }

    // When creating a new extension, also create a new Ignore instance.
    if (event.type === 'extension_folder_created') {
      this.ignored[event.path] = this.createIgnoreInstance(event.path)
    }

    // If the event is ignored by the custom gitignore patterns, don't push it
    if (event.extensionPath !== 'unknown' && this.ignored[event.extensionPath]) {
      const relative = relativePath(event.extensionPath, event.path)
      if (this.ignored[event.extensionPath]?.ignores(relative)) return
    }

    // If the event is already in the list, don't push it again
    if (this.currentEvents.some((extEvent) => extEvent.path === event.path && extEvent.type === event.type)) return
    this.currentEvents.push(event)
    this.debouncedEmit()
  }

  listenForAbortOnWatcher = (watcher: FSWatcher) => {
    this.options.signal.addEventListener('abort', () => {
      outputDebug(`Closing file watcher`, this.options.stdout)
      watcher
        .close()
        .then(() => outputDebug(`File watching closed`, this.options.stdout))
        .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, this.options.stderr))
    })
  }

  // Returns an ignore instance for the given path if a .gitignore file exists, otherwise undefined
  createIgnoreInstance(path: string): ignore.Ignore | undefined {
    const gitIgnorePath = joinPath(path, '.gitignore')
    if (!fileExistsSync(gitIgnorePath)) return undefined
    const gitIgnoreContent = readFileSync(gitIgnorePath)
      .toString()
      .split('\n')
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern !== '' && !pattern.startsWith('#'))
    return ignore.default().add(gitIgnoreContent)
  }
}

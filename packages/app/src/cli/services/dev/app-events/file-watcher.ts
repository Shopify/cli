/* eslint-disable no-case-declarations */
import {AppLinkedInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, joinPath, normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, readFileSync} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
import ignore from 'ignore'
import {Writable} from 'stream'

const DEFAULT_DEBOUNCE_TIME_IN_MS = 200
const EXTENSION_CREATION_TIMEOUT_IN_MS = 60000
const EXTENSION_CREATION_CHECK_INTERVAL_IN_MS = 200
const FILE_DELETE_TIMEOUT_IN_MS = 500

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
  private currentEvents: WatcherEvent[] = []
  private extensionPaths: string[] = []
  private app: AppLinkedInterface
  private readonly options: OutputContextOptions
  private onChangeCallback?: (events: WatcherEvent[]) => void
  private watcher?: FSWatcher
  private readonly debouncedEmit: () => void
  private readonly ignored: {[key: string]: ignore.Ignore | undefined} = {}
  // Map of file paths to the extensions that watch them
  private readonly extensionWatchedFiles = new Map<string, Set<string>>()

  constructor(
    app: AppLinkedInterface,
    options: OutputContextOptions,
    debounceTime: number = DEFAULT_DEBOUNCE_TIME_IN_MS,
  ) {
    this.app = app
    this.options = options

    /**
     * Debounced function to emit the accumulated events.
     * This function will be called at most once every DEFAULT_DEBOUNCE_TIME_IN_MS
     * to avoid emitting too many events in a short period.
     */
    this.debouncedEmit = debounce(this.emitEvents.bind(this), debounceTime, {leading: true, trailing: true})
    this.updateApp(app)
  }

  onChange(listener: (events: WatcherEvent[]) => void) {
    this.onChangeCallback = listener
  }

  /**
   * Starts a new file watcher, and closes the previous one if it exists.
   * This ensures the watcher picks up any changes in what files need to be watched.
   */
  async start(): Promise<void> {
    const extensionDirectories = [...(this.app.configuration.extension_directories ?? ['extensions'])]
    const fullExtensionDirectories = extensionDirectories.map((directory) => joinPath(this.app.directory, directory))
    const watchPaths = [this.app.configuration.path, ...fullExtensionDirectories]

    // Get all watched files from extensions
    const allWatchedFiles = this.getAllWatchedFiles()
    watchPaths.push(...allWatchedFiles)

    this.close()

    // Create new watcher
    const {default: chokidar} = await import('chokidar')
    this.watcher = chokidar.watch(watchPaths, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/*.test.*',
        '**/dist/**',
        '**/*.swp',
        '**/generated/**',
        '**/.gitignore',
      ],
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('all', this.handleFileEvent)
    this.addAbortListener()

    outputDebug(`File watcher started with ${watchPaths.length} paths`, this.options.stdout)
  }

  updateApp(app: AppLinkedInterface) {
    this.app = app
    this.extensionPaths = this.app.nonConfigExtensions
      .map((ext) => normalizePath(ext.directory))
      .filter((dir) => dir !== this.app.directory)
    this.extensionPaths.forEach((path) => {
      this.ignored[path] ??= this.createIgnoreInstance(path)
    })
  }

  private addAbortListener() {
    this.options.signal.removeEventListener('abort', this.close)
    this.options.signal.addEventListener('abort', this.close)
  }

  /**
   * Gets all files that need to be watched from all extensions
   */
  private getAllWatchedFiles(): string[] {
    this.extensionWatchedFiles.clear()

    const extensionResults = this.app.nonConfigExtensions.map((extension) => ({
      extension,
      watchedFiles: extension.watchedFiles(),
    }))

    const allFiles = new Set<string>()
    for (const {extension, watchedFiles} of extensionResults) {
      const extensionDir = normalizePath(extension.directory)
      for (const file of watchedFiles) {
        const normalizedPath = normalizePath(file)
        allFiles.add(normalizedPath)

        // Track which extensions watch this file
        const extensionsSet = this.extensionWatchedFiles.get(normalizedPath) ?? new Set()
        extensionsSet.add(extensionDir)
        this.extensionWatchedFiles.set(normalizedPath, extensionsSet)
      }
    }

    return Array.from(allFiles)
  }

  /**
   * Emits the accumulated events and resets the current events list.
   * It also logs the number of events emitted and their paths for debugging purposes.
   */
  private readonly emitEvents = () => {
    const events = this.currentEvents
    this.currentEvents = []
    const message = `🔉 ${events.length} EVENTS EMITTED in files: ${events.map((event) => event.path).join('\n')}`
    outputDebug(message, this.options.stdout)
    this.onChangeCallback?.(events)
  }

  /**
   * Adds a new event to the current events list and schedules the debounced emit function.
   * If the event is already in the list, it will not be added again.
   *
   * @param event - The event to be added
   */
  private pushEvent(event: WatcherEvent) {
    if (this.shouldIgnoreEvent(event)) return

    // If the event is for a new extension folder, create a new ignore instance
    if (event.type === 'extension_folder_created') {
      this.ignored[event.path] = this.createIgnoreInstance(event.path)
    }

    // If the event is already in the list, don't push it again
    // Check path, type, AND extensionPath to properly handle shared files
    if (
      this.currentEvents.some(
        (extEvent) =>
          extEvent.path === event.path &&
          extEvent.type === event.type &&
          extEvent.extensionPath === event.extensionPath,
      )
    )
      return

    this.currentEvents.push(event)
  }

  /**
   * Whether an event should be ignored or not based on the extension's watch paths and gitignore file.
   * Never ignores extension create/delete events.
   *
   * If the affected extension defines custom watch paths, ignore the event if the path is not in the list
   * ELSE, if the extension has a custom gitignore file, ignore the event if the path matches the patterns
   * Explicit watch paths have priority over custom gitignore files
   */
  private shouldIgnoreEvent(event: WatcherEvent) {
    if (event.type === 'extension_folder_deleted' || event.type === 'extension_folder_created') return false

    const extension = this.app.realExtensions.find((ext) => ext.directory === event.extensionPath)
    const watchPaths = extension?.watchedFiles()
    const ignoreInstance = this.ignored[event.extensionPath]

    if (watchPaths) {
      const isAValidWatchedPath = watchPaths.some((pattern) => matchGlob(event.path, pattern))
      return !isAValidWatchedPath
    } else if (ignoreInstance) {
      const relative = relativePath(event.extensionPath, event.path)
      return ignoreInstance.ignores(relative)
    }

    return false
  }

  private readonly handleFileEvent = (event: string, path: string) => {
    const startTime = startHRTime()
    const normalizedPath = normalizePath(path)
    const isConfigAppPath = path === this.app.configuration.path
    const isExtensionToml = path.endsWith('.extension.toml')

    outputDebug(`🌀: ${event} ${path.replace(this.app.directory, '')}\n`)

    if (isConfigAppPath) {
      this.handleEventForExtension(event, path, this.app.directory, startTime, false)
    } else {
      const affectedExtensions = this.extensionWatchedFiles.get(normalizedPath)
      const isUnknownExtension = affectedExtensions === undefined || affectedExtensions.size === 0

      if (isUnknownExtension && !isExtensionToml && !isConfigAppPath) {
        // Ignore an event if it's not part of an existing extension
        // Except if it is a toml file (either app config or extension config)
        outputDebug(`🌀: File ${path} is not watched by any extension`, this.options.stdout)
        return
      }

      for (const extensionPath of affectedExtensions ?? []) {
        this.handleEventForExtension(event, path, extensionPath, startTime, false)
      }
      if (isUnknownExtension) {
        this.handleEventForExtension(event, path, this.app.directory, startTime, true)
      }
    }
    this.debouncedEmit()
  }

  private handleEventForExtension(
    event: string,
    path: string,
    extensionPath: string,
    startTime: StartTime,
    isUnknownExtension: boolean,
  ) {
    const isExtensionToml = path.endsWith('.extension.toml')
    const isConfigAppPath = path === this.app.configuration.path

    switch (event) {
      case 'change':
        if (isUnknownExtension) {
          // If the extension path is unknown, it means the extension was just created.
          // We need to wait for the lock file to disappear before triggering the event.
          break
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
            totalWaitedTime += EXTENSION_CREATION_CHECK_INTERVAL_IN_MS
          } else {
            clearInterval(intervalId)
            this.extensionPaths.push(realPath)
            this.pushEvent({type: 'extension_folder_created', path: realPath, extensionPath, startTime})
            // Force an emit because we are inside a timeout callback
            this.debouncedEmit()
          }
          if (totalWaitedTime >= EXTENSION_CREATION_TIMEOUT_IN_MS) {
            clearInterval(intervalId)
            this.options.stderr.write(`Error loading new extension at path: ${path}.\n Please restart the process.`)
          }
        }, EXTENSION_CREATION_CHECK_INTERVAL_IN_MS)
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
          setTimeout(() => {
            // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
            if (!this.extensionPaths.includes(extensionPath)) return
            this.pushEvent({type: 'file_deleted', path, extensionPath, startTime})
            // Force an emit because we are inside a timeout callback
            this.debouncedEmit()
          }, FILE_DELETE_TIMEOUT_IN_MS)
        }
        break
      // These events are ignored
      case 'addDir':
      case 'unlinkDir':
        break
    }
  }

  private readonly close = () => {
    if (!this.watcher) return

    outputDebug(`Closing file watcher`, this.options.stdout)
    this.watcher
      .close()
      .then(() => outputDebug(`File watching closed`, this.options.stdout))
      .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, this.options.stderr))
  }

  // Creates an "Ignore" instance for the given path if a .gitignore file exists, otherwise undefined
  private createIgnoreInstance(path: string): ignore.Ignore | undefined {
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

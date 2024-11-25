/* eslint-disable no-case-declarations */
import {AppInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, isSubpath, joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, readFileSync} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
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
  private extensionPaths: string[]
  private readonly watchPaths: string[]
  private readonly customGitIgnoredPatterns: string[]
  private readonly app: AppInterface
  private readonly options: OutputContextOptions
  private onChangeCallback?: (events: WatcherEvent[]) => void
  private watcher?: FSWatcher
  private readonly debouncedEmit: () => void

  constructor(app: AppInterface, options: OutputContextOptions, debounceTime: number = DEFAULT_DEBOUNCE_TIME_IN_MS) {
    this.app = app
    this.options = options

    // Current active extension paths (not defined in the main app configuration file)
    // If a change happens outside of these paths, it will be ignored unless is for a new extension being created
    // When a new extension is created, the path is added to this list
    // When an extension is deleted, the path is removed from this list
    // For every change, the corresponding extensionPath will be also reported in the event
    this.extensionPaths = app.realExtensions
      .map((ext) => normalizePath(ext.directory))
      .filter((dir) => dir !== app.directory)

    const extensionDirectories = [...(app.configuration.extension_directories ?? ['extensions'])].map((directory) => {
      return joinPath(app.directory, directory)
    })

    this.watchPaths = [app.configuration.path, ...extensionDirectories]

    // Read .gitignore files from extension directories and add the patterns to the ignored list
    this.customGitIgnoredPatterns = this.getCustomGitIgnorePatterns()

    /**
     * Debounced function to emit the accumulated events.
     * This function will be called at most once every 500ms to avoid emitting too many events in a short period.
     */
    this.debouncedEmit = debounce(this.emitEvents.bind(this), debounceTime, {leading: true, trailing: true})
  }

  onChange(listener: (events: WatcherEvent[]) => void) {
    this.onChangeCallback = listener
  }

  async start(): Promise<void> {
    const {default: chokidar} = await import('chokidar')

    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/*.test.*',
        '**/dist/**',
        '**/*.swp',
        '**/generated/**',
        ...this.customGitIgnoredPatterns,
      ],
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher.on('all', this.handleFileEvent)
    this.options.signal.addEventListener('abort', this.close)
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
    const extension = this.app.realExtensions.find((ext) => ext.directory === event.extensionPath)
    const watchPaths = extension?.devSessionWatchPaths

    // If the affected extension defines custom watch paths, ignore the event if it's not in the list
    if (watchPaths) {
      const isAValidWatchedPath = watchPaths.some((pattern) => matchGlob(event.path, pattern))
      if (!isAValidWatchedPath) return
    }

    // If the event is already in the list, don't push it again
    if (this.currentEvents.some((extEvent) => extEvent.path === event.path && extEvent.type === event.type)) return
    this.currentEvents.push(event)
    this.debouncedEmit()
  }

  private readonly handleFileEvent = (event: string, path: string) => {
    const startTime = startHRTime()
    const isConfigAppPath = path === this.app.configuration.path
    const extensionPath =
      this.extensionPaths.find((dir) => isSubpath(dir, path)) ?? (isConfigAppPath ? this.app.directory : 'unknown')
    const isToml = path.endsWith('.toml')

    outputDebug(`🌀: ${event} ${path.replace(this.app.directory, '')}\n`)

    if (extensionPath === 'unknown' && !isToml) return

    switch (event) {
      case 'change':
        if (isToml) {
          this.pushEvent({type: 'extensions_config_updated', path, extensionPath, startTime})
        } else {
          this.pushEvent({type: 'file_updated', path, extensionPath, startTime})
        }
        break
      case 'add':
        // If it's a normal non-toml file, just report a file_created event.
        // If a toml file was added, a new extension(s) is being created.
        // We need to wait for the lock file to disappear before triggering the event.
        if (!isToml) {
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
          }
          if (totalWaitedTime >= EXTENSION_CREATION_TIMEOUT_IN_MS) {
            clearInterval(intervalId)
            this.options.stderr.write(
              `Extension creation detection timeout at path: ${path}\nYou might need to restart dev`,
            )
          }
        }, EXTENSION_CREATION_CHECK_INTERVAL_IN_MS)
        break
      case 'unlink':
        // Ignore shoplock files
        if (path.endsWith(configurationFileNames.lockFile)) break

        if (isConfigAppPath) {
          this.pushEvent({type: 'app_config_deleted', path, extensionPath, startTime})
        } else if (isToml) {
          // When a toml is deleted, we can consider every extension in that folder was deleted.
          this.extensionPaths = this.extensionPaths.filter((extPath) => extPath !== extensionPath)
          this.pushEvent({type: 'extension_folder_deleted', path: extensionPath, extensionPath, startTime})
        } else {
          setTimeout(() => {
            // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
            if (!this.extensionPaths.includes(extensionPath)) return
            this.pushEvent({type: 'file_deleted', path, extensionPath, startTime})
          }, FILE_DELETE_TIMEOUT_IN_MS)
        }
        break
      // These events are ignored
      case 'addDir':
      case 'unlinkDir':
        break
    }
  }

  /**
   * Returns the custom gitignore patterns for the given extension directories.
   *
   * @returns The custom gitignore patterns
   */
  private getCustomGitIgnorePatterns(): string[] {
    return this.extensionPaths
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
  }

  private readonly close = () => {
    outputDebug(`Closing file watcher`, this.options.stdout)
    this.watcher
      ?.close()
      .then(() => outputDebug(`File watching closed`, this.options.stdout))
      .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, this.options.stderr))
  }
}

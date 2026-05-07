/* eslint-disable no-case-declarations */
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, joinPath, normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, mkdir} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
import {Writable} from 'stream'

const DEFAULT_DEBOUNCE_TIME_IN_MS = 200
const EXTENSION_CREATION_TIMEOUT_IN_MS = 60000
const EXTENSION_CREATION_CHECK_INTERVAL_IN_MS = 200
const FILE_DELETE_TIMEOUT_IN_MS = 500

/**
 * Returns the directory prefix of a glob pattern (the longest leading path with
 * no wildcards), or the pattern itself if it has none. Patterns are expected to
 * be absolute. An empty result means the pattern is too unrooted to be useful
 * as a chokidar watch root.
 */
function staticGlobPrefix(pattern: string): string {
  const match = /[*?[\](){}!]/.exec(pattern)
  if (!match) return pattern
  const head = pattern.slice(0, match.index)
  const lastSlash = head.lastIndexOf('/')
  return lastSlash <= 0 ? '' : head.slice(0, lastSlash)
}

/**
 * Event emitted by the file watcher
 *
 * Includes the type of the event, the path of the file that triggered the event and the extension handle that owns the file.
 * For folder-level events (create, delete), extensionHandle is undefined since the extension may not exist yet.
 *
 * @typeParam type - The type of the event
 * @typeParam path - The path of the file that triggered the event
 * @typeParam extensionHandle - The unique handle of the extension that owns the file
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
  /** The unique handle of the extension that owns this file. Undefined for folder-level events. */
  extensionHandle?: string
  /** The directory path of the extension. Used for folder-level events (create/delete) where no extension handle exists yet. */
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
  // Map of file paths to the extension handles that watch them
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

    // Ensure extension directories exist so chokidar can watch them.
    // Chokidar v3 silently ignores non-existent directories.
    // Strip glob suffixes (e.g. extensions/** → extensions) since mkdir needs real paths.
    // Errors are non-fatal — if mkdir fails (e.g. permissions), chokidar will still
    // try to watch the path and handle it gracefully.
    await Promise.all(
      fullExtensionDirectories.map(async (dir) => {
        try {
          await mkdir(dir.replace(/\/\*+$/, ''))
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch {
          // Non-fatal: directory may be unwritable (e.g. test fixtures)
        }
      }),
    )

    const watchPaths = [this.app.configPath, ...fullExtensionDirectories]

    // Get all watched files from extensions
    const allWatchedFiles = this.getAllWatchedFiles()
    watchPaths.push(...allWatchedFiles)

    // Watch the static prefix of every external watch glob so that NEW files
    // created in those directories at runtime are surfaced by chokidar. Without
    // this, chokidar would only see the specific files returned by globSync.
    watchPaths.push(...this.getExternalWatchRoots(fullExtensionDirectories))

    this.close()

    // Create new watcher
    const {default: chokidar} = await import('chokidar')
    this.watcher = chokidar.watch(watchPaths, {
      ignored: ['**/node_modules/**', '**/.git/**'],
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
  }

  private addAbortListener() {
    this.options.signal.removeEventListener('abort', this.close)
    this.options.signal.addEventListener('abort', this.close)
  }

  /**
   * Returns the static prefix of every extension watch glob that lives outside
   * the directories chokidar already watches recursively. Used to surface NEW
   * files created at runtime in externally-watched roots (e.g. an admin
   * extension's `static_root` or a function's shared sources).
   */
  private getExternalWatchRoots(coveredDirectories: string[]): string[] {
    const covered = coveredDirectories.map((dir) => normalizePath(dir.replace(/\/\*+$/, '')))
    const roots = new Set<string>()
    for (const extension of this.app.realExtensions) {
      if (!extension.devSessionWatchConfig) continue
      for (const pattern of extension.watchPatterns().paths) {
        const prefix = staticGlobPrefix(pattern)
        if (!prefix) continue
        if (covered.some((dir) => prefix === dir || prefix.startsWith(`${dir}/`))) continue
        roots.add(prefix)
      }
    }
    return Array.from(roots)
  }

  /**
   * Gets all files that need to be watched from all extensions
   */
  private getAllWatchedFiles(): string[] {
    this.extensionWatchedFiles.clear()

    const extensionResults = this.app.realExtensions.map((extension) => ({
      extension,
      watchedFiles: extension.watchedFiles(),
    }))

    const allFiles = new Set<string>()
    for (const {extension, watchedFiles} of extensionResults) {
      for (const file of watchedFiles) {
        const normalizedPath = normalizePath(file)
        allFiles.add(normalizedPath)

        // Track which extension handles watch this file
        const handlesSet = this.extensionWatchedFiles.get(normalizedPath) ?? new Set()
        handlesSet.add(extension.handle)
        this.extensionWatchedFiles.set(normalizedPath, handlesSet)
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
    // If the event is already in the list, don't push it again.
    // Check path, type, AND extensionHandle to properly handle shared files.
    if (
      this.currentEvents.some(
        (extEvent) =>
          extEvent.path === event.path &&
          extEvent.type === event.type &&
          extEvent.extensionHandle === event.extensionHandle,
      )
    )
      return

    this.currentEvents.push(event)
  }

  private readonly handleFileEvent = (event: string, path: string) => {
    const startTime = startHRTime()
    const normalizedPath = normalizePath(path)
    const isConfigAppPath = path === this.app.configPath
    const isExtensionToml = path.endsWith('.extension.toml')

    outputDebug(`🌀: ${event} ${path.replace(this.app.directory, '')}\n`)

    if (isConfigAppPath) {
      this.handleEventForExtension(event, path, this.app.directory, startTime, false)
    } else {
      let affectedHandles = this.extensionWatchedFiles.get(normalizedPath)
      let isUnknownExtension = affectedHandles === undefined || affectedHandles.size === 0

      // For 'add' events on paths we don't yet track, try to attribute them to an
      // existing extension by directory containment + watch pattern matching. This
      // is what allows files created during a running dev session to be picked up.
      if (isUnknownExtension && event === 'add' && !isExtensionToml) {
        const discovered = this.discoverFileOwners(normalizedPath)
        if (discovered.size > 0) {
          this.extensionWatchedFiles.set(normalizedPath, discovered)
          affectedHandles = discovered
          isUnknownExtension = false
        }
      }

      if (isUnknownExtension && !isExtensionToml && !isConfigAppPath) {
        // Ignore an event if it's not part of an existing extension
        // Except if it is a toml file (either app config or extension config)
        outputDebug(`🌀: File ${path} is not watched by any extension`, this.options.stdout)
        return
      }

      for (const handle of affectedHandles ?? []) {
        const extension = this.app.realExtensions.find((ext) => ext.handle === handle)
        const extensionPath = extension ? normalizePath(extension.directory) : this.app.directory
        this.handleEventForExtension(event, path, extensionPath, startTime, false, handle)
      }
      if (isUnknownExtension) {
        this.handleEventForExtension(event, path, this.app.directory, startTime, true)
      }
    }
    this.debouncedEmit()
  }

  /**
   * Returns the handles of every extension that should track the given path
   * based on the extension's watch patterns. A path can match multiple
   * extensions when they share a directory or watch patterns.
   *
   * Two attribution modes:
   * - Inside the extension directory: default `**\/*` patterns apply.
   * - Outside the extension directory: only extensions with explicit
   *   `devSessionWatchConfig` (e.g. admin `static_root`, a function pointing at
   *   shared sources) are eligible.
   */
  private discoverFileOwners(normalizedPath: string): Set<string> {
    const owners = new Set<string>()
    for (const extension of this.app.realExtensions) {
      const extensionDir = normalizePath(extension.directory)
      const isInside = normalizedPath.startsWith(`${extensionDir}/`)
      const hasExplicitConfig = extension.devSessionWatchConfig !== undefined

      if (extensionDir === this.app.directory && !hasExplicitConfig) continue
      if (!isInside && !hasExplicitConfig) continue

      if (this.pathMatchesWatchPatterns(normalizedPath, extension)) {
        owners.add(extension.handle)
      }
    }
    return owners
  }

  /**
   * Tests a path against an extension's watch patterns. Patterns may be either
   * absolute (e.g. function specs join with `extension.directory`) or relative
   * to the extension directory (e.g. the default `**\/*`), so we try both forms.
   */
  private pathMatchesWatchPatterns(normalizedPath: string, extension: ExtensionInstance): boolean {
    const {paths, ignore: ignorePatterns} = extension.watchPatterns()
    const relative = relativePath(normalizePath(extension.directory), normalizedPath)
    const matches = (pattern: string) => matchGlob(normalizedPath, pattern) || matchGlob(relative, pattern)
    if (ignorePatterns.some(matches)) return false
    return paths.some(matches)
  }

  private handleEventForExtension(
    event: string,
    path: string,
    extensionPath: string,
    startTime: StartTime,
    isUnknownExtension: boolean,
    extensionHandle?: string,
  ) {
    const isExtensionToml = path.endsWith('.extension.toml')
    const isConfigAppPath = path === this.app.configPath

    switch (event) {
      case 'change':
        if (isUnknownExtension) {
          // If the extension path is unknown, it means the extension was just created.
          // We need to wait for the lock file to disappear before triggering the event.
          break
        }
        if (isExtensionToml || isConfigAppPath) {
          this.pushEvent({type: 'extensions_config_updated', path, extensionPath, extensionHandle, startTime})
        } else {
          this.pushEvent({type: 'file_updated', path, extensionPath, extensionHandle, startTime})
        }
        break
      case 'add':
        // If it's a normal non-toml file, just report a file_created event.
        // If a toml file was added, a new extension(s) is being created.
        // We need to wait for the lock file to disappear before triggering the event.
        if (!isExtensionToml) {
          this.pushEvent({type: 'file_created', path, extensionPath, extensionHandle, startTime})
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
            this.pushEvent({type: 'file_deleted', path, extensionPath, extensionHandle, startTime})
            // Drop the path from our ownership map so it doesn't leak across a
            // long-running dev session. Subsequent timeouts for other handles
            // are no-ops on the now-missing key.
            this.extensionWatchedFiles.delete(normalizePath(path))
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
}

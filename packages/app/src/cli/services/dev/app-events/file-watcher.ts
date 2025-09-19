/* eslint-disable no-case-declarations */
import {AppLinkedInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {dirname, isSubpath, joinPath, normalizePath, relativePath, resolvePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, readFileSync} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
import ignore from 'ignore'
import {extractImportPaths} from '@shopify/cli-kit/node/import-extractor'
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
  // Map of imported file paths to the extension paths that import them
  private readonly importedFileToExtensions = new Map<string, Set<string>>()
  // Promise to coordinate rescan operations and prevent concurrent rescanning
  private rescanPromise: Promise<void> | null = null

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
    this.app = app
    this.extensionPaths = this.app.realExtensions
      .map((ext) => normalizePath(ext.directory))
      .filter((dir) => dir !== this.app.directory)
  }

  onChange(listener: (events: WatcherEvent[]) => void) {
    this.onChangeCallback = listener
  }

  async start(): Promise<void> {
    const {default: chokidar} = await import('chokidar')

    const extensionDirectories = [...(this.app.configuration.extension_directories ?? ['extensions'])]
    const fullExtensionDirectories = extensionDirectories.map((directory) => joinPath(this.app.directory, directory))

    const watchPaths = [this.app.configuration.path, ...fullExtensionDirectories]

    const importedPaths = await this.scanExtensionsForImports()
    watchPaths.push(...importedPaths)

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
    this.options.signal.addEventListener('abort', this.close)
  }

  async updateApp(app: AppLinkedInterface) {
    this.app = app
    this.extensionPaths = this.app.realExtensions
      .map((ext) => normalizePath(ext.directory))
      .filter((dir) => dir !== this.app.directory)
    this.extensionPaths.forEach((path) => {
      this.ignored[path] ??= this.createIgnoreInstance(path)
    })
    await this.scanExtensionsForImports()
  }

  /**
   * Scans extensions for imports and tracks which files are imported by which extensions
   */
  async scanExtensionsForImports(extensions: ExtensionInstance[] = this.app.nonConfigExtensions): Promise<string[]> {
    console.log(
      'scanExtensionsForImports',
      extensions.map((ext) => ext.handle),
    )

    this.clearImportMappingsForExtensions(extensions)

    // Extract imports from all extensions in parallel
    const extensionResults = await Promise.all(
      extensions.map(async (extension) => {
        try {
          const entryFiles = extension.getExtensionEntryFiles()
          const imports: string[] = []

          entryFiles.forEach((entryFile) => {
            imports.push(...extractImportPaths(entryFile))
          })

          outputDebug(`Found ${imports.length} imports for extension ${extension.handle}`)
          return {extension, imports}
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          outputDebug(`Failed to extract imports for extension at ${extension.directory}: ${error}`)
          return {extension, imports: []}
        }
      }),
    )

    this.updateImportMappings(extensionResults)

    // Get all imported paths that need to be watched
    const importedPaths = this.getAllImportedPaths()

    // Update the watcher with any new imported paths
    if (importedPaths.length > 0 && this.watcher) {
      outputDebug(`Updating watcher with ${importedPaths.length} imported paths`)
      this.watcher.add(importedPaths)
    }

    return importedPaths
  }

  /**
   * Clears import mappings for specific extensions
   */
  private clearImportMappingsForExtensions(extensions: ExtensionInstance[]): void {
    if (extensions === this.app.realExtensions) {
      this.importedFileToExtensions.clear()
      return
    }

    const extensionDirs = new Set(extensions.map((ext) => normalizePath(ext.directory)))

    for (const [importPath, importingExtensions] of this.importedFileToExtensions.entries()) {
      for (const extDir of extensionDirs) {
        importingExtensions.delete(extDir)
      }
      if (importingExtensions.size === 0) {
        this.importedFileToExtensions.delete(importPath)
      }
    }
  }

  /**
   * Updates the import mappings with new scan results
   */
  private updateImportMappings(results: {extension: ExtensionInstance; imports: string[]}[]): void {
    for (const {extension, imports} of results) {
      const extensionDir = normalizePath(extension.directory)

      for (const importPath of imports) {
        const normalizedImportPath = normalizePath(resolvePath(importPath))

        // Skip files within the extension directory
        if (isSubpath(extensionDir, normalizedImportPath)) continue

        // Add mapping
        if (!this.importedFileToExtensions.has(normalizedImportPath)) {
          this.importedFileToExtensions.set(normalizedImportPath, new Set())
        }
        const extensionSet = this.importedFileToExtensions.get(normalizedImportPath)
        if (extensionSet) {
          extensionSet.add(extensionDir)
        }
      }
    }
  }

  /**
   * Gets all imported file paths that need to be watched
   */
  private getAllImportedPaths(): string[] {
    const paths: string[] = []
    for (const [normalizedPath] of this.importedFileToExtensions) {
      paths.push(resolvePath(normalizedPath))
    }
    return paths
  }

  /**
   * Rescans imports for specific extensions and updates the watcher
   * This method never throws - all errors are handled internally
   */
  private async rescanExtensionImports(extensionPaths: string[]): Promise<void> {
    // If there's already a rescan in progress, wait for it to complete first
    if (this.rescanPromise) {
      outputDebug(`Waiting for existing rescan to complete before rescanning ${extensionPaths.length} extensions`)
      await this.rescanPromise
    }

    // Create a new promise for this rescan operation
    this.rescanPromise = (async () => {
      try {
        // Find all extensions that need rescanning
        const extensions: ExtensionInstance[] = []
        const normalizedPaths = new Set(extensionPaths.map((path) => normalizePath(path)))

        for (const extension of this.app.realExtensions) {
          if (normalizedPaths.has(normalizePath(extension.directory))) {
            extensions.push(extension)
          }
        }

        if (extensions.length === 0) {
          outputDebug(`No extensions found for paths: ${extensionPaths.join(', ')}`)
          return
        }

        outputDebug(
          `Rescanning imports for ${extensions.length} extensions: ${extensions.map((ext) => ext.handle).join(', ')}`,
        )

        // Call scanExtensionsForImports with all affected extensions to refresh their mappings
        await this.scanExtensionsForImports(extensions)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        outputDebug(`Failed to rescan imports for extensions: ${error}`)
      }
    })()

    try {
      await this.rescanPromise
    } finally {
      // Clear the promise when done
      this.rescanPromise = null
    }
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
    if (this.currentEvents.some((extEvent) => extEvent.path === event.path && extEvent.type === event.type)) return
    this.currentEvents.push(event)
    this.debouncedEmit()
  }

  /**
   * Whether an event should be ignored or not based on the extension's watch paths and gitignore file.
   * Never ignores extension create/delete events or imported file events.
   *
   * If the affected extension defines custom watch paths, ignore the event if the path is not in the list
   * ELSE, if the extension has a custom gitignore file, ignore the event if the path matches the patterns
   * Explicit watch paths have priority over custom gitignore files
   */
  private shouldIgnoreEvent(event: WatcherEvent) {
    if (event.type === 'extension_folder_deleted' || event.type === 'extension_folder_created') return false

    // Check if this is an imported file event - never ignore these
    // Import map uses normalized resolved paths
    const resolvedPath = resolvePath(event.path)
    const normalizedResolvedPath = normalizePath(resolvedPath)
    if (this.importedFileToExtensions.has(normalizedResolvedPath)) {
      return false
    }

    const extension = this.app.realExtensions.find((ext) => ext.directory === event.extensionPath)
    const watchPaths = extension?.devSessionWatchPaths
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
    const directExtensionPath = this.extensionPaths.find((dir) => isSubpath(dir, normalizedPath))
    const isExtensionToml = path.endsWith('.extension.toml')

    outputDebug(`🌀: ${event} ${path.replace(this.app.directory, '')}\n`)

    // Check if this is an imported file that affects multiple extensions
    if (!directExtensionPath && !isConfigAppPath) {
      const resolvedPath = resolvePath(path)
      const normalizedResolvedPath = normalizePath(resolvedPath)
      const affectedExtensions = this.importedFileToExtensions.get(normalizedResolvedPath)

      if (affectedExtensions && affectedExtensions.size > 0) {
        // Trigger events for all extensions that import this file
        for (const extensionPath of affectedExtensions) {
          this.handleEventForExtension(event, path, extensionPath, startTime)
        }
        // Rescan imports for all affected extensions
        // eslint-disable-next-line no-void
        void this.rescanExtensionImports(Array.from(affectedExtensions))
        return
      }
    }

    // Handle regular extension files
    const extensionPath = directExtensionPath ?? (isConfigAppPath ? this.app.directory : 'unknown')
    this.handleEventForExtension(event, path, extensionPath, startTime, isExtensionToml, isConfigAppPath)
  }

  private handleEventForExtension(
    event: string,
    path: string,
    extensionPath: string,
    startTime: StartTime,
    isExtensionTomlParam?: boolean,
    isConfigAppPathParam?: boolean,
  ) {
    // Determine file type if not provided
    const isExtensionToml = isExtensionTomlParam ?? path.endsWith('.extension.toml')
    const isConfigAppPath = isConfigAppPathParam ?? path === this.app.configuration.path
    const isUnknownExtension = extensionPath === 'unknown'

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
            totalWaitedTime += EXTENSION_CREATION_CHECK_INTERVAL_IN_MS
          } else {
            clearInterval(intervalId)
            this.extensionPaths.push(realPath)
            this.pushEvent({type: 'extension_folder_created', path: realPath, extensionPath, startTime})
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
    outputDebug(`Closing file watcher`, this.options.stdout)
    this.watcher
      ?.close()
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

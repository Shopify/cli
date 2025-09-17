/* eslint-disable no-case-declarations */
import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {configurationFileNames} from '../../../constants.js'
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
    const importedPaths = await this.scanExtensionsForImports()

    if (this.watcher) {
      this.watcher.add(importedPaths)
    }
  }

  /**
   * Scans each extension for imports and tracks which files are imported by which extensions
   */
  private async scanExtensionsForImports(): Promise<string[]> {
    this.importedFileToExtensions.clear()
    const allImportedPaths = new Set<string>()

    // Extract imports from all extensions in parallel
    const extensionResults = await Promise.all(
      this.app.realExtensions.map(async (extension) => {
        try {
          const entryFiles = this.getExtensionEntryFiles(extension)
          const allImports: string[] = []

          // Extract imports from all entry files
          for (const entryFile of entryFiles) {
            const imports = extractImportPaths(entryFile)
            allImports.push(...imports)
          }

          return {extension, imports: allImports}
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (error) {
          outputDebug(`Failed to extract imports for extension at ${extension.directory}: ${error}`)
          return {extension, imports: []}
        }
      }),
    )

    // Process results and update maps
    for (const {extension, imports} of extensionResults) {
      for (const importPath of imports) {
        const resolvedImportPath = resolvePath(importPath)
        const normalizedImportPath = normalizePath(resolvedImportPath)

        // Skip files that are already in the extension directory
        if (isSubpath(normalizePath(extension.directory), normalizedImportPath)) continue

        // Add to the global set of imported paths (use the resolved path for watching)
        allImportedPaths.add(resolvedImportPath)

        // Track which extension imports this file (use normalized path for lookup)
        if (!this.importedFileToExtensions.has(normalizedImportPath)) {
          this.importedFileToExtensions.set(normalizedImportPath, new Set())
        }
        const extensionSet = this.importedFileToExtensions.get(normalizedImportPath)
        if (extensionSet) {
          extensionSet.add(normalizePath(extension.directory))
        }
      }
    }

    return Array.from(allImportedPaths)
  }

  /**
   * Gets the entry files for an extension by checking various sources
   */
  private getExtensionEntryFiles(extension: ExtensionInstance): string[] {
    const entryFiles: string[] = []

    // First, check if we have an explicit entrySourceFilePath
    if (extension.entrySourceFilePath) {
      entryFiles.push(extension.entrySourceFilePath)
      return entryFiles
    }

    // For UI extensions, check targeting/extension_points configuration
    const config = extension.configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetingConfig = (config as any).targeting || (config as any).extension_points
    if (targetingConfig && Array.isArray(targetingConfig)) {
      for (const target of targetingConfig) {
        if (target.module) {
          const modulePath = joinPath(extension.directory, target.module)
          if (fileExistsSync(modulePath)) {
            entryFiles.push(modulePath)
          }
        }
      }
    }

    return entryFiles
  }

  /**
   * Rescans imports for a specific extension and updates the watcher
   * This method never throws - all errors are handled internally
   */
  private rescanExtensionImports(extensionPath: string): void {
    try {
      const extension = this.app.realExtensions.find((ext) => normalizePath(ext.directory) === extensionPath)
      if (!extension) return

      const entryFiles = this.getExtensionEntryFiles(extension)
      const newImports: string[] = []

      // Extract imports from all entry files
      for (const entryFile of entryFiles) {
        const imports = extractImportPaths(entryFile)
        newImports.push(...imports)
      }

      // Remove old imports for this extension from the map
      for (const [importPath, extensions] of this.importedFileToExtensions.entries()) {
        extensions.delete(extensionPath)
        if (extensions.size === 0) {
          this.importedFileToExtensions.delete(importPath)
        }
      }

      // Add new imports to the map and collect new paths to watch
      const newPaths: string[] = []
      for (const importPath of newImports) {
        const resolvedImportPath = resolvePath(importPath)
        const normalizedImportPath = normalizePath(resolvedImportPath)

        // Skip imports within the extension directory
        if (isSubpath(extensionPath, normalizedImportPath)) continue

        if (!this.importedFileToExtensions.has(normalizedImportPath)) {
          this.importedFileToExtensions.set(normalizedImportPath, new Set())
          newPaths.push(resolvedImportPath)
        }
        const extensionSet = this.importedFileToExtensions.get(normalizedImportPath)
        if (extensionSet) {
          extensionSet.add(extensionPath)
        }
      }

      // Add new paths to the watcher
      if (newPaths.length > 0 && this.watcher) {
        outputDebug(`Adding ${newPaths.length} new imported paths to watcher for ${extension.handle}`)
        this.watcher.add(newPaths)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputDebug(`Failed to rescan imports for extension at ${extensionPath}: ${error}`)
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
   * Never ignores extension create/delete events.
   *
   * If the affected extension defines custom watch paths, ignore the event if the path is not in the list
   * ELSE, if the extension has a custom gitignore file, ignore the event if the path matches the patterns
   * Explicit watch paths have priority over custom gitignore files
   */
  private shouldIgnoreEvent(event: WatcherEvent) {
    if (event.type === 'extension_folder_deleted' || event.type === 'extension_folder_created') return false

    // Check if this is an imported file event - never ignore these
    const normalizedEventPath = normalizePath(event.path)
    if (this.importedFileToExtensions.has(normalizedEventPath)) {
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
      // Try multiple path formats to find the file in the import map
      const resolvedPath = resolvePath(path)
      const normalizedResolvedPath = normalizePath(resolvedPath)

      const affectedExtensions =
        this.importedFileToExtensions.get(normalizedPath) ??
        this.importedFileToExtensions.get(path) ??
        this.importedFileToExtensions.get(resolvedPath) ??
        this.importedFileToExtensions.get(normalizedResolvedPath)

      if (affectedExtensions && affectedExtensions.size > 0) {
        // Trigger events for all extensions that import this file
        for (const extensionPath of affectedExtensions) {
          this.handleEventForExtension(event, path, extensionPath, startTime)
        }
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
          this.rescanExtensionImports(normalizePath(extensionPath))
        }
        break
      case 'add':
        // If it's a normal non-toml file, just report a file_created event.
        // If a toml file was added, a new extension(s) is being created.
        // We need to wait for the lock file to disappear before triggering the event.
        if (!isExtensionToml) {
          this.pushEvent({type: 'file_created', path, extensionPath, startTime})
          this.rescanExtensionImports(normalizePath(extensionPath))
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

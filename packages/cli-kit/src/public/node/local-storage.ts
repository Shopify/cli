import {AbortError, BugError} from './error.js'
import {fileExistsSync, fileHasWritePermissions, findPathUpSync, unixFileIsOwnedByCurrentUser} from './fs.js'
import {dirname, resolvePath} from './path.js'
import {TokenItem} from './ui.js'
import Config from 'conf'
import envPaths from 'env-paths'

function isFileSystemPermissionError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error)) return false
  const errorCode = (error as NodeJS.ErrnoException).code
  return errorCode === 'EACCES' || errorCode === 'EPERM'
}

function configPathFromInitializationError(
  options: {projectName?: string; cwd?: string},
  error: NodeJS.ErrnoException,
): string | undefined {
  if (typeof error.path === 'string') {
    return error.syscall === 'mkdir' ? resolvePath(error.path, 'config.json') : resolvePath(error.path)
  }

  const configDirectory =
    options.cwd ?? (options.projectName ? envPaths(options.projectName, {suffix: 'nodejs'}).config : undefined)
  return configDirectory ? resolvePath(configDirectory, 'config.json') : undefined
}

function deserializeJson<T>(value: string): T {
  // Some Windows editors encode UTF-8 files with a byte order mark, which JSON.parse does not accept.
  const valueWithoutByteOrderMark = value.replace(/^\uFEFF/, '')
  return JSON.parse(valueWithoutByteOrderMark) as T
}

/**
 * A wrapper around the `conf` package that provides a strongly-typed interface
 * for accessing the local storage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class LocalStorage<T extends Record<string, any>> {
  private readonly config: Config<T>

  constructor(options: {projectName?: string; cwd?: string}) {
    try {
      this.config = new Config<T>({
        ...options,
        clearInvalidConfig: true,
        deserialize: deserializeJson<T>,
      })
    } catch (error) {
      if (!isFileSystemPermissionError(error)) throw error

      const configPath = configPathFromInitializationError(options, error)
      if (configPath) this.handleError(error, 'initialize', configPath)

      throw new AbortError(`Failed to access local storage (initialize): ${error}`)
    }
  }

  /**
   * Get a value from the local storage.
   *
   * @param key - The key to get.
   * @returns The value.
   * @throws AbortError if a permission error occurs.
   * @throws BugError if an unexpected error occurs.
   */
  get<TKey extends keyof T>(key: TKey): T[TKey] | undefined {
    try {
      return this.config.get(key)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.handleError(error, 'get')
    }
  }

  /**
   * Set a value in the local storage.
   *
   * @param key - The key to set.
   * @param value - The value to set.
   * @throws AbortError if a permission error occurs.
   * @throws BugError if an unexpected error occurs.
   */
  set<TKey extends keyof T>(key: TKey, value?: T[TKey]): void {
    try {
      this.config.set(key, value)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.handleError(error, 'set')
    }
  }

  /**
   * Delete a value from the local storage.
   *
   * @param key - The key to delete.
   * @throws AbortError if a permission error occurs.
   * @throws BugError if an unexpected error occurs.
   */
  delete<TKey extends keyof T>(key: TKey): void {
    try {
      this.config.delete(key)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.handleError(error, 'delete')
    }
  }

  /**
   * Clear the local storage (delete all values).
   *
   * @throws AbortError if a permission error occurs.
   * @throws BugError if an unexpected error occurs.
   */
  clear(): void {
    try {
      this.config.clear()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      this.handleError(error, 'clear')
    }
  }

  /**
   * Handle errors from config operations.
   * If the error is permission-related, throw an AbortError with helpful hints.
   * Otherwise, throw a BugError.
   *
   * @param error - The error that occurred.
   * @param operation - The operation that failed.
   * @param configPath - The local storage configuration file path.
   * @throws AbortError if the error is permission-related.
   * @throws BugError if the error is not permission-related.
   */
  private handleError(error: unknown, operation: string, configPath = this.config.path): never {
    if (isFileSystemPermissionError(error) || this.isPermissionError(configPath)) {
      throw new AbortError(`Failed to access local storage (${operation}): ${error}`, this.tryMessage(configPath))
    } else {
      throw new BugError(`Unexpected error while accessing local storage at ${configPath} (${operation}): ${error}`)
    }
  }

  private isPermissionError(configPath: string): boolean {
    const canAccessFile = fileHasWritePermissions(configPath)
    const canAccessFolder = fileHasWritePermissions(dirname(configPath))
    const ownsFile = unixFileIsOwnedByCurrentUser(configPath)

    return !canAccessFile || !canAccessFolder || ownsFile === false
  }

  private tryMessage(configPath: string) {
    const configDirectory = dirname(configPath)
    const configDirectoryExists = fileExistsSync(configDirectory)
    const permissionsPath = configDirectoryExists
      ? configPath
      : (findPathUpSync('.', {cwd: configDirectory, type: 'directory'}) ?? configDirectory)
    const ownsFile = fileExistsSync(configPath) ? unixFileIsOwnedByCurrentUser(configPath) : undefined
    const ownershipDirectory = configDirectoryExists ? configDirectory : permissionsPath
    const ownsFolder = unixFileIsOwnedByCurrentUser(ownershipDirectory)

    const message: TokenItem = [`Check that you have write permissions for`, {filePath: permissionsPath}]
    if (ownsFile === false || ownsFolder === false) {
      message.push(
        '- The file is owned by a different user. This typically happens when Shopify CLI was previously run with elevated permissions (e.g., sudo).',
      )
    }

    if (configDirectoryExists) {
      message.push('\n\nTo resolve this, remove the Shopify CLI preferences folder:')
      message.push({filePath: configDirectory})
    }

    return message
  }
}

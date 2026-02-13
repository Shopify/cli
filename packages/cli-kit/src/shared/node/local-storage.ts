import {AbortError, BugError} from './error.js'
import {fileHasWritePermissions, unixFileIsOwnedByCurrentUser} from './fs.js'
import {dirname} from './path.js'
import {TokenItem} from './ui.js'
import Config from 'conf'

/**
 * A wrapper around the `conf` package that provides a strongly-typed interface
 * for accessing the local storage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class LocalStorage<T extends {[key: string]: any}> {
  private readonly config: Config<T>

  constructor(options: {projectName?: string; cwd?: string}) {
    this.config = new Config<T>(options)
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
   * @throws AbortError if the error is permission-related.
   * @throws BugError if the error is not permission-related.
   */
  private handleError(error: unknown, operation: string): never {
    if (this.isPermissionError()) {
      throw new AbortError(`Failed to access local storage (${operation}): ${error}`, this.tryMessage())
    } else {
      throw new BugError(
        `Unexpected error while accessing local storage at ${this.config.path} (${operation}): ${error}`,
      )
    }
  }

  private isPermissionError(): boolean {
    const canAccessFile = fileHasWritePermissions(this.config.path)
    const canAccessFolder = fileHasWritePermissions(dirname(this.config.path))
    const ownsFile = unixFileIsOwnedByCurrentUser(this.config.path)

    return !canAccessFile || !canAccessFolder || ownsFile === false
  }

  private tryMessage() {
    const ownsFile = unixFileIsOwnedByCurrentUser(this.config.path)
    const ownsFolder = unixFileIsOwnedByCurrentUser(dirname(this.config.path))

    const message: TokenItem = [`Check that you have write permissions for`, {filePath: this.config.path}]
    if (ownsFile === false || ownsFolder === false) {
      message.push(
        '- The file is owned by a different user. This typically happens when Shopify CLI was previously run with elevated permissions (e.g., sudo).',
      )
    }

    message.push('\n\nTo resolve this, remove the Shopify CLI preferences folder:')
    message.push({command: `rm -rf ${dirname(this.config.path)}`})

    return message
  }
}

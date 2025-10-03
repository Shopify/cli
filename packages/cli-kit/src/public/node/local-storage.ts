import {AbortError} from './error.js'
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
   */
  get<TKey extends keyof T>(key: TKey): T[TKey] | undefined {
    return this.config.get(key)
  }

  /**
   * Set a value in the local storage.
   *
   * @param key - The key to set.
   * @param value - The value to set.
   * @throws Error If the value cannot be set.
   */
  set<TKey extends keyof T>(key: TKey, value?: T[TKey]): void {
    try {
      this.config.set(key, value)
    } catch (error) {
      throw new AbortError(this.errorMessage(error, 'set'))
    }
  }

  /**
   * Delete a value from the local storage.
   *
   * @param key - The key to delete.
   * @throws Error If the value cannot be deleted.
   */
  delete<TKey extends keyof T>(key: TKey): void {
    try {
      this.config.delete(key)
    } catch (error) {
      throw new AbortError(this.errorMessage(error, 'delete'))
    }
  }

  /**
   * Clear the local storage (delete all values).
   *
   * @throws Error If the local storage cannot be cleared.
   */
  clear(): void {
    try {
      this.config.clear()
    } catch (error) {
      throw new AbortError(this.errorMessage(error, 'clear'))
    }
  }

  private errorMessage(error: unknown, operation: string): string {
    return `Failed to access local storage (${operation}). Validate that you have write permissions at ${this.config.path}. ${error}`
  }
}

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
   */
  set<TKey extends keyof T>(key: TKey, value?: T[TKey]): void {
    this.config.set(key, value)
  }

  /**
   * Delete a value from the local storage.
   *
   * @param key - The key to delete.
   */
  delete<TKey extends keyof T>(key: TKey): void {
    this.config.delete(key)
  }

  /**
   * Clear the local storage (delete all values).
   */
  clear(): void {
    this.config.clear()
  }
}

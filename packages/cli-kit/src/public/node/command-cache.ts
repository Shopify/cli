import {isUnitTest} from './context/local.js'
import {LocalStorage} from './local-storage.js'
import {outputDebug} from './output.js'

interface CommandLocalStorage {
  [key: string]: {[key: string]: unknown}
}

export interface CommandCacheOptions {
  /**
   * ID of the command to read data from. Defaults to the SHOPIFY_CLI_COMMAND_RUN_ID environment variable.
   */
  commandId?: string
  /**
   * Folder to store the cache in. Defaults to the Conf folder: https://github.com/sindresorhus/env-paths#pathsconfig.
   */
  cwd?: string
}

let _commandLocalStorageInstance: LocalStorage<CommandLocalStorage> | undefined

function commandLocalStorage(cwd: string | undefined = undefined): LocalStorage<CommandLocalStorage> {
  if (!_commandLocalStorageInstance || isUnitTest()) {
    _commandLocalStorageInstance = new LocalStorage<CommandLocalStorage>({
      projectName: 'shopify-cli-command-cache',
      cwd,
    })
  }
  return _commandLocalStorageInstance
}

/**
 * Saves data to the command cache.
 *
 * @param data - Key-value pairs to save.
 * @param options - Options for saving the data.
 */
export function setCachedCommandInfo(data: {[key: string]: unknown}, options: CommandCacheOptions = {}): void {
  const commandId = options.commandId || process.env.SHOPIFY_CLI_COMMAND_RUN_ID
  if (!commandId) return

  const store = commandLocalStorage(options.cwd)
  const currentData = store.get(commandId)

  store.set(commandId, {
    ...currentData,
    ...data,
  })
}

/**
 * Reads data from the command cache.
 *
 * @param options - Options for reading the data.
 * @returns The data if exists or undefined.
 */
export function getCachedCommandInfo(options: CommandCacheOptions = {}): {[key: string]: unknown} | undefined {
  const commandId = options.commandId || process.env.SHOPIFY_CLI_COMMAND_RUN_ID
  if (!commandId) return

  const store = commandLocalStorage(options.cwd)
  return store.get(commandId)
}

/**
 * Clears the command cache.
 *
 * @param cwd - Current working directory where the cache is stored.
 */
export function clearCachedCommandInfo(cwd: string | undefined = undefined): void {
  const store = commandLocalStorage(cwd)
  store.clear()
}

/**
 * Runs a function or returns the cached result if it was already run during the current command.
 *
 * @param cacheKey - String to use as a key for caching.
 * @param fn - Function to run if the cache key is not found, and cache the result of.
 * @param options - Options for the cache store.
 * @returns The result of the function.
 */
export async function runWithCommandCache<T>(
  cacheKey: string,
  fn: () => T,
  options: CommandCacheOptions = {},
): Promise<T> {
  // let queries = {} as {[key: string]: unknown}

  const data = (getCachedCommandInfo(options) as {[key: string]: unknown}) || {}
  if (data[cacheKey]) {
    // queries = data.queries as {[key: string]: unknown}
    outputDebug(`Reading from cache with key: ${cacheKey}`)
    return data[cacheKey] as T
  }

  const result = await fn()

  outputDebug(`Caching result with key: ${cacheKey}`)
  data[cacheKey] = result
  setCachedCommandInfo(data, options)

  return result
}

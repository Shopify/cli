import {LocalStorage} from './local-storage.js'

interface CommandLocalStorage {
  [key: string]: {[key: string]: unknown}
}

let _commandLocalStorageInstance: LocalStorage<CommandLocalStorage> | undefined

function commandLocalStorage() {
  if (!_commandLocalStorageInstance) {
    _commandLocalStorageInstance = new LocalStorage<CommandLocalStorage>({projectName: 'shopify-cli-command-cache'})
  }
  return _commandLocalStorageInstance
}

/**
 * Saves data to the command cache.
 *
 * @param data - Key-value pairs to save.
 * @param commandId - ID of the command to read data from. Defaults to the COMMAND_RUN_ID environment variable.
 */
export function setCachedCommandInfo(
  data: {[key: string]: unknown},
  commandId: string | undefined = process.env.COMMAND_RUN_ID,
): void {
  if (!commandId) return

  const store = commandLocalStorage()
  const currentData = store.get(commandId)

  store.set(commandId, {
    ...currentData,
    ...data,
  })
}

/**
 * Reads data from the command cache.
 *
 * @param commandId - ID of the command to read data from. Defaults to the COMMAND_RUN_ID environment variable.
 * @returns The data if exists or undefined.
 */
export function getCachedCommandInfo(
  commandId: string | undefined = process.env.COMMAND_RUN_ID,
): {[key: string]: unknown} | undefined {
  if (!commandId) return

  const store = commandLocalStorage()
  return store.get(commandId)
}

/**
 * Clears the command cache.
 */
export function clearCachedCommandInfo(): void {
  const store = commandLocalStorage()
  store.clear()
}

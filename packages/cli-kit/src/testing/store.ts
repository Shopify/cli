import {CLIKitStore} from '../store.js'
import {remove} from '../file.js'
import uniqueString from 'unique-string'

/**
 * Creates a temporary configuration store and ties its lifecycle to the callback.
 * @param callback {(string) => void} Callback to execute. When the callback exits, the local config is destroyed.
 * @returns {Promise<T>} Promise that resolves with the value returned by the callback.
 */
export async function temporaryTestStore<T>(callback: (store: CLIKitStore) => Promise<T>): Promise<T> {
  let localConf: CLIKitStore | undefined
  try {
    const name = `shopify-cli-test-${uniqueString()}`
    localConf = new CLIKitStore({projectName: name})
    // eslint-disable-next-line node/callback-return
    const result = callback(localConf)
    return result
  } finally {
    if (localConf) {
      await remove(localConf.path)
      const configFolder = localConf.path.replace(/\/config.json$/, '')
      await remove(configFolder)
    }
  }
}

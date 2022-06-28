import tempy from 'tempy'

/**
 * Creates a temporary directory and ties its lifecycle to the callback.
 * @param callback {(string) => void} Callback to execute. When the callback exits, the temporary directory is destroyed.
 * @returns {Promise<T>} Promise that resolves with the value returned by the callback.
 */
export async function temporaryDirectory<T>(callback: (directory: string) => Promise<T>): Promise<T> {
  const result = await tempy.directory.task(callback, {})
  return result
}

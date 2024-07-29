// Needed for some tests (like chokidar event handlers), which do not support async
/**
 * Flushes all pending promises.
 *
 * @returns A promise that resolves when all pending promises are resolved.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

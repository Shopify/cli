import {resolve, join} from './path'
import os from 'node:os'

/**
 * Returns directory that the environment variable XDG_CACHE_HOME
 * points to or the .cache directory under the home directory.
 * @returns {string} Cache directory
 */
export function cacheHome(): string {
  const xdgCacheHome = process.env.XDG_CACHE_HOME
  if (xdgCacheHome) {
    resolve(xdgCacheHome)
  }
  return join(os.homedir(), '.cache')
}

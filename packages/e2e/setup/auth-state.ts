/* eslint-disable no-restricted-imports */
import {directories} from './env.js'
import * as path from 'path'

export function authStatePaths() {
  const authDir = path.join(process.env.E2E_TEMP_DIR ?? path.join(directories.root, '.e2e-tmp'), 'global-auth')

  return {
    authDir,
    storageStatePath: path.join(authDir, 'browser-storage-state.json'),
    xdgEnv: {
      XDG_DATA_HOME: path.join(authDir, 'XDG_DATA_HOME'),
      XDG_CONFIG_HOME: path.join(authDir, 'XDG_CONFIG_HOME'),
      XDG_STATE_HOME: path.join(authDir, 'XDG_STATE_HOME'),
      XDG_CACHE_HOME: path.join(authDir, 'XDG_CACHE_HOME'),
    },
  }
}

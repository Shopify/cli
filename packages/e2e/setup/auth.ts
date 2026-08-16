import {browserFixture} from './browser.js'
import {authStatePaths} from './auth-state.js'
import {AuthSetupError} from './auth-diagnostics.js'
import {globalLog} from './env.js'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = {log: (_ctx: any, msg: string) => globalLog('auth', msg)}

/**
 * Worker-scoped fixture that provides an authenticated CLI session.
 *
 * Copies the pre-authenticated session from the remote auth setup into this
 * worker's isolated XDG directories.
 *
 * Fixture chain: envFixture → cliFixture → browserFixture → authFixture
 */
export const authFixture = browserFixture.extend<{}, {authLogin: void}>({
  authLogin: [
    async ({env}, use) => {
      const {xdgEnv: authXdgEnv} = authStatePaths()
      const authDirs = Object.values(authXdgEnv)

      if (!authDirs.every((directory) => fs.existsSync(directory))) {
        throw new AuthSetupError('session-prewarm', 'auth-artifacts-missing')
      }

      log.log(env, 'copying session from auth setup')
      fs.cpSync(authXdgEnv.XDG_CONFIG_HOME, env.processEnv.XDG_CONFIG_HOME!, {recursive: true})
      fs.cpSync(authXdgEnv.XDG_DATA_HOME, env.processEnv.XDG_DATA_HOME!, {recursive: true})
      fs.cpSync(authXdgEnv.XDG_STATE_HOME, env.processEnv.XDG_STATE_HOME!, {recursive: true})
      fs.cpSync(authXdgEnv.XDG_CACHE_HOME, env.processEnv.XDG_CACHE_HOME!, {recursive: true})

      await use()
    },
    {scope: 'worker'},
  ],
})

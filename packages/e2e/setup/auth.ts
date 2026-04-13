/* eslint-disable no-restricted-imports */
import {browserFixture} from './browser.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {globalLog, executables} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {execa} from 'execa'
import * as fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = {log: (_ctx: any, msg: string) => globalLog('auth', msg)}


/**
 * Worker-scoped fixture that provides an authenticated CLI session.
 *
 * If globalSetup already ran auth (E2E_AUTH_CONFIG_DIR is set), copies the
 * pre-authenticated session files into this worker's isolated XDG dirs.
 * Otherwise falls back to running auth login directly (single-worker mode).
 *
 * Fixture chain: envFixture → cliFixture → browserFixture → authFixture
 */
export const authFixture = browserFixture.extend<{}, {authLogin: void}>({
  authLogin: [
    async ({env, browserPage}, use) => {
      const email = process.env.E2E_ACCOUNT_EMAIL
      const password = process.env.E2E_ACCOUNT_PASSWORD

      if (!email || !password) {
        await use()
        return
      }

      const authConfigDir = process.env.E2E_AUTH_CONFIG_DIR
      const authDataDir = process.env.E2E_AUTH_DATA_DIR
      const authStateDir = process.env.E2E_AUTH_STATE_DIR
      const authCacheDir = process.env.E2E_AUTH_CACHE_DIR

      if (authConfigDir && authDataDir && authStateDir && authCacheDir) {
        // Copy pre-authenticated session from global setup
        log.log(env, 'copying session from global setup')

        fs.cpSync(authConfigDir, env.processEnv.XDG_CONFIG_HOME!, {recursive: true})
        fs.cpSync(authDataDir, env.processEnv.XDG_DATA_HOME!, {recursive: true})
        fs.cpSync(authStateDir, env.processEnv.XDG_STATE_HOME!, {recursive: true})
        fs.cpSync(authCacheDir, env.processEnv.XDG_CACHE_HOME!, {recursive: true})

        await use()
        return
      }

      // Fallback: run auth login directly (single-worker / no global setup)
      log.log(env, 'authenticating automatically')

      await execa('node', [executables.cli, 'auth', 'logout'], {
        env: env.processEnv,
        reject: false,
      })

      const nodePty = await import('node-pty')
      const spawnEnv: {[key: string]: string} = {}
      for (const [key, value] of Object.entries(env.processEnv)) {
        if (value !== undefined) spawnEnv[key] = value
      }
      spawnEnv.CI = ''
      spawnEnv.CODESPACES = 'true'

      const ptyProcess = nodePty.spawn('node', [executables.cli, 'auth', 'login'], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        env: spawnEnv,
      })

      let output = ''
      ptyProcess.onData((data: string) => {
        output += data
        if (process.env.DEBUG === '1') process.stdout.write(data)
      })

      await waitForText(() => output, 'Open this link to start the auth process', CLI_TIMEOUT.short)

      const stripped = stripAnsi(output)
      const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
      if (!urlMatch) {
        throw new Error(`Could not find login URL in output:\n${stripped}`)
      }

      await completeLogin(browserPage, urlMatch[0], email, password)

      await waitForText(() => output, 'Logged in', BROWSER_TIMEOUT.max)
      try {
        ptyProcess.kill()
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_error) {
        // Process may already be dead
      }

      await use()
    },
    {scope: 'worker'},
  ],
})

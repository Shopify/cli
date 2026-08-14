import {browserFixture} from './browser.js'
import {authStatePaths} from './auth-state.js'
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
 * If the remote project's auth setup completed, copies the pre-authenticated
 * session files into this worker's isolated XDG dirs.
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

      const {xdgEnv: authXdgEnv} = authStatePaths()
      const authDirs = Object.values(authXdgEnv)

      if (authDirs.every((directory) => fs.existsSync(directory))) {
        log.log(env, 'copying session from auth setup')
        fs.cpSync(authXdgEnv.XDG_CONFIG_HOME, env.processEnv.XDG_CONFIG_HOME!, {recursive: true})
        fs.cpSync(authXdgEnv.XDG_DATA_HOME, env.processEnv.XDG_DATA_HOME!, {recursive: true})
        fs.cpSync(authXdgEnv.XDG_STATE_HOME, env.processEnv.XDG_STATE_HOME!, {recursive: true})
        fs.cpSync(authXdgEnv.XDG_CACHE_HOME, env.processEnv.XDG_CACHE_HOME!, {recursive: true})

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

      await waitForText(() => output, 'link to start the auth process', CLI_TIMEOUT.short)

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

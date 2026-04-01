import {browserFixture} from './browser.js'
import {executables} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {execa} from 'execa'

/**
 * Worker-scoped fixture that performs OAuth login using the shared browser page.
 *
 * Extends browserFixture — the browser is already running when auth starts.
 * After login, the CLI session is stored in XDG dirs and the browser page
 * remains available for other browser-based actions (dashboard navigation, etc.).
 *
 * Fixture chain: envFixture → cliFixture → browserFixture → authFixture
 */
export const authFixture = browserFixture.extend<{}, {authLogin: void}>({
  authLogin: [
    async ({env, browserPage}, use) => {
      // Remove the partners token BEFORE any CLI commands run (and before the early-return).
      // The token takes highest priority in the CLI auth chain (getAppAutomationToken in session.ts).
      // When present, the CLI exchanges it for an App Management token that can't create apps (403).
      // We must delete from BOTH env.processEnv AND process.env because execa merges its env
      // option with the parent's process.env by default (extendEnv: true).
      delete env.processEnv.SHOPIFY_CLI_PARTNERS_TOKEN
      delete process.env.SHOPIFY_CLI_PARTNERS_TOKEN

      const email = process.env.E2E_ACCOUNT_EMAIL
      const password = process.env.E2E_ACCOUNT_PASSWORD

      if (!email || !password) {
        await use()
        return
      }

      process.stdout.write('[e2e] Authenticating automatically — no action required.\n')

      // Clear any existing session
      await execa('node', [executables.cli, 'auth', 'logout'], {
        env: env.processEnv,
        reject: false,
      })

      // Spawn auth login via PTY (must not have CI=1)
      const nodePty = await import('node-pty')
      const spawnEnv: {[key: string]: string} = {}
      for (const [key, value] of Object.entries(env.processEnv)) {
        if (value !== undefined) spawnEnv[key] = value
      }
      spawnEnv.CI = ''
      // Print login URL directly instead of opening system browser
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

      await waitForText(() => output, 'Open this link to start the auth process', 30_000)

      const stripped = stripAnsi(output)
      const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
      if (!urlMatch) {
        throw new Error(`Could not find login URL in output:\n${stripped}`)
      }

      await completeLogin(browserPage, urlMatch[0], email, password)

      await waitForText(() => output, 'Logged in', 60_000)
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

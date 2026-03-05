/* eslint-disable no-restricted-imports */
import {cliFixture} from './cli.js'
import {executables} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {chromium, type Browser} from '@playwright/test'
import {execa} from 'execa'

/**
 * Worker-scoped fixture that performs OAuth login via browser automation.
 * Runs once per worker, stores the session in shared XDG dirs.
 */
export const authFixture = cliFixture.extend<{}, {authLogin: void}>({
  authLogin: [
    async ({env}, use) => {
      const email = process.env.E2E_ACCOUNT_EMAIL
      const password = process.env.E2E_ACCOUNT_PASSWORD

      if (!email || !password) {
        await use()
        return
      }

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
      // Pretend we're in a cloud environment so the CLI prints the login URL
      // directly instead of opening a system browser (BROWSER=none doesn't work on macOS)
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

      let browser: Browser | undefined
      try {
        browser = await chromium.launch({headless: !process.env.E2E_HEADED})
        const context = await browser.newContext({
          extraHTTPHeaders: {
            'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
          },
        })
        const page = await context.newPage()
        await completeLogin(page, urlMatch[0], email, password)
      } finally {
        await browser?.close()
      }

      await waitForText(() => output, 'Logged in', 60_000)
      try {
        ptyProcess.kill()
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_error) {
        // Process may already be dead
      }

      // Remove the partners token so CLI uses the OAuth session
      // instead of the token (which can't auth against Business Platform API)
      delete env.processEnv.SHOPIFY_CLI_PARTNERS_TOKEN

      await use()
    },
    {scope: 'worker'},
  ],
})

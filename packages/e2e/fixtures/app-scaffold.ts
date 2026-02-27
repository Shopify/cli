import {cliFixture} from './cli-process.js'
import {executables, directories} from './env.js'
import type {E2EEnv} from './env.js'
import type {CLIProcess, ExecResult} from './cli-process.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {chromium, type Browser, type Page} from '@playwright/test'
import {execa} from 'execa'
import * as path from 'path'
import * as fs from 'fs'

export interface AppScaffold {
  /** The directory where the app was created */
  appDir: string
  /** Create a new app from a template */
  init(opts: AppInitOptions): Promise<ExecResult>
  /** Generate an extension in the app */
  generateExtension(opts: ExtensionOptions): Promise<ExecResult>
  /** Build the app */
  build(): Promise<ExecResult>
  /** Get app info as JSON */
  appInfo(): Promise<AppInfoResult>
}

export interface AppInitOptions {
  name?: string
  template?: 'reactRouter' | 'remix' | 'none'
  flavor?: 'javascript' | 'typescript'
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export interface ExtensionOptions {
  name: string
  template: string
  flavor?: string
}

export interface AppInfoResult {
  packageManager: string
  allExtensions: Array<{
    configuration: {name: string; type: string; handle?: string}
    directory: string
    outputPath: string
    entrySourceFilePath: string
  }>
}

/**
 * Worker-scoped fixture that performs OAuth login via browser automation.
 * Runs once per worker, stores the session in shared XDG dirs.
 */
const withAuth = cliFixture.extend<{}, {authLogin: void}>({
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
      const spawnEnv: Record<string, string> = {}
      for (const [key, value] of Object.entries(env.processEnv)) {
        if (value !== undefined) spawnEnv[key] = value
      }
      spawnEnv.CI = ''
      spawnEnv.BROWSER = 'none'

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

      await waitForText(() => output, 'Press any key to open the login page', 30_000)
      ptyProcess.write(' ')
      await waitForText(() => output, 'start the auth process', 10_000)

      const stripped = stripAnsi(output)
      const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
      if (!urlMatch) {
        throw new Error(`Could not find login URL in output:\n${stripped}`)
      }

      let browser: Browser | undefined
      try {
        browser = await chromium.launch({headless: !process.env.E2E_HEADED})
        const page = await browser.newPage()
        await completeLogin(page, urlMatch[0], email, password)
      } finally {
        await browser?.close()
      }

      await waitForText(() => output, 'Logged in', 60_000)
      try { ptyProcess.kill() } catch { /* already dead */ }

      // Remove the partners token so CLI uses the OAuth session
      // instead of the token (which can't auth against Business Platform API)
      delete env.processEnv.SHOPIFY_CLI_PARTNERS_TOKEN

      await use()
    },
    {scope: 'worker'},
  ],
})

/**
 * Test-scoped fixture that creates a fresh app in a temp directory.
 * Depends on authLogin (worker-scoped) for OAuth session.
 */
export const appScaffoldFixture = withAuth.extend<{appScaffold: AppScaffold}>({
  // eslint-disable-next-line no-empty-pattern
  appScaffold: async ({cli, env, authLogin: _}, use) => {
    const appTmpDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    let appDir = ''

    const scaffold: AppScaffold = {
      get appDir() {
        if (!appDir) throw new Error('App has not been initialized yet. Call init() first.')
        return appDir
      },

      async init(opts: AppInitOptions) {
        const name = opts.name ?? 'e2e-test-app'
        const template = opts.template ?? 'reactRouter'
        const packageManager = opts.packageManager ?? 'npm'

        const args = [
          '--name', name,
          '--path', appTmpDir,
          '--package-manager', packageManager,
          '--local',
          '--template', template,
        ]
        if (opts.flavor) args.push('--flavor', opts.flavor)

        const result = await cli.execCreateApp(args, {
          env: {FORCE_COLOR: '0'},
          timeout: 5 * 60 * 1000,
        })

        const allOutput = result.stdout + '\n' + result.stderr
        const match = allOutput.match(/([\w-]+) is ready for you to build!/)

        if (match?.[1]) {
          appDir = path.join(appTmpDir, match[1])
        } else {
          const entries = fs.readdirSync(appTmpDir, {withFileTypes: true})
          const appEntry = entries.find(
            (e) => e.isDirectory() && fs.existsSync(path.join(appTmpDir, e.name, 'shopify.app.toml')),
          )
          if (appEntry) {
            appDir = path.join(appTmpDir, appEntry.name)
          } else {
            throw new Error(
              `Could not find created app directory in ${appTmpDir}.\n` +
              `Exit code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
            )
          }
        }

        const npmrcPath = path.join(appDir, '.npmrc')
        if (!fs.existsSync(npmrcPath)) fs.writeFileSync(npmrcPath, '')
        fs.appendFileSync(npmrcPath, 'frozen-lockfile=false\n')

        return result
      },

      async generateExtension(opts: ExtensionOptions) {
        const args = [
          'app', 'generate', 'extension',
          '--name', opts.name,
          '--path', appDir,
          '--template', opts.template,
        ]
        if (opts.flavor) args.push('--flavor', opts.flavor)
        return cli.exec(args, {timeout: 5 * 60 * 1000})
      },

      async build() {
        return cli.exec(['app', 'build', '--path', appDir], {timeout: 5 * 60 * 1000})
      },

      async appInfo(): Promise<AppInfoResult> {
        const result = await cli.exec(['app', 'info', '--path', appDir, '--json'])
        return JSON.parse(result.stdout)
      },
    }

    await use(scaffold)
    fs.rmSync(appTmpDir, {recursive: true, force: true})
  },
})

async function completeLogin(page: Page, loginUrl: string, email: string, password: string): Promise<void> {
  await page.goto(loginUrl)
  await page.waitForSelector('input[name="account[email]"], input[type="email"]', {timeout: 15_000})
  await page.locator('input[name="account[email]"], input[type="email"]').first().fill(email)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForSelector('input[name="account[password]"], input[type="password"]', {timeout: 15_000})
  await page.locator('input[name="account[password]"], input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(3000)
  try {
    const btn = page.locator('button[type="submit"]').first()
    if (await btn.isVisible({timeout: 5000})) await btn.click()
  } catch { /* no confirmation page */ }
}

function waitForText(getOutput: () => string, text: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (stripAnsi(getOutput()).includes(text)) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve()
      }
    }, 200)
    const timer = setTimeout(() => {
      clearInterval(interval)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for: "${text}"\n\nOutput:\n${stripAnsi(getOutput())}`))
    }, timeoutMs)
  })
}

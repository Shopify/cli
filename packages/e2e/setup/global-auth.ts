/**
 * Playwright globalSetup — authenticates once before any workers start.
 *
 * Auth artifacts are stored in a stable `global-auth/` dir. Workers copy
 * the session files into their own isolated XDG dirs via E2E_AUTH_* env vars.
 */

/* eslint-disable no-restricted-imports */
import {directories, executables, globalLog} from './env.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {execa} from 'execa'
import {chromium, type Page} from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

function isAccountsShopifyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === 'accounts.shopify.com'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

export default async function globalSetup() {
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD

  if (!email || !password) return

  const debug = process.env.DEBUG === '1'
  globalLog('auth', 'global setup starting')

  // All auth artifacts stored in a stable dir
  const tmpBase = process.env.E2E_TEMP_DIR ?? path.join(directories.root, '.e2e-tmp')
  fs.mkdirSync(tmpBase, {recursive: true})
  const authDir = path.join(tmpBase, 'global-auth')
  const storageStatePath = path.join(authDir, 'browser-storage-state.json')

  const xdgEnv = {
    XDG_DATA_HOME: path.join(authDir, 'XDG_DATA_HOME'),
    XDG_CONFIG_HOME: path.join(authDir, 'XDG_CONFIG_HOME'),
    XDG_STATE_HOME: path.join(authDir, 'XDG_STATE_HOME'),
    XDG_CACHE_HOME: path.join(authDir, 'XDG_CACHE_HOME'),
  }

  const processEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...xdgEnv,
    SHOPIFY_RUN_AS_USER: '0',
    NODE_OPTIONS: '',
    CI: '1',
    SHOPIFY_CLI_1P_DEV: undefined,
    SHOPIFY_FLAG_CLIENT_ID: undefined,
  }

  // Create fresh XDG dirs
  for (const dir of Object.values(xdgEnv)) {
    fs.mkdirSync(dir, {recursive: true})
  }

  // Clear any existing session
  await execa('node', [executables.cli, 'auth', 'logout'], {
    env: processEnv,
    reject: false,
  })

  // Spawn auth login via PTY
  const nodePty = await import('node-pty')
  const spawnEnv: {[key: string]: string} = {}
  for (const [key, value] of Object.entries(processEnv)) {
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
    if (debug) process.stdout.write(data)
  })

  try {
    await waitForText(() => output, 'Open this link to start the auth process', CLI_TIMEOUT.short)

    const stripped = stripAnsi(output)
    const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
    if (!urlMatch) {
      throw new Error(`[e2e] global-auth: could not find login URL in output:\n${stripped}`)
    }

    // Complete login in a headless browser
    const browser = await chromium.launch({headless: !process.env.E2E_HEADED})
    try {
      const context = await browser.newContext({
        extraHTTPHeaders: {
          'X-Shopify-Loadtest-Bf8d22e7-120e-4b5b-906c-39ca9d5499a9': 'true',
        },
      })
      const page = await context.newPage()

      await completeLogin(page, urlMatch[0], email, password)

      await waitForText(() => output, 'Logged in', BROWSER_TIMEOUT.max)

      // Visit admin.shopify.com and dev.shopify.com to establish session cookies
      // (completeLogin only authenticates on accounts.shopify.com)
      const orgId = (process.env.E2E_ORG_ID ?? '').trim()
      if (orgId) {
        await visitAndHandleAccountPicker(page, 'https://admin.shopify.com/', email)
        await visitAndHandleAccountPicker(page, `https://dev.shopify.com/dashboard/${orgId}/apps`, email)
        globalLog('auth', 'browser sessions established for admin + dev dashboard')
      }

      // Save browser cookies/storage so workers can reuse the session
      await context.storageState({path: storageStatePath})
    } finally {
      await browser.close()
    }
  } finally {
    try {
      ptyProcess.kill()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_error) {
      // Process may already be dead
    }
  }

  // Store paths so workers can copy CLI auth + load browser state
  /* eslint-disable require-atomic-updates */
  process.env.E2E_AUTH_CONFIG_DIR = xdgEnv.XDG_CONFIG_HOME
  process.env.E2E_AUTH_DATA_DIR = xdgEnv.XDG_DATA_HOME
  process.env.E2E_AUTH_STATE_DIR = xdgEnv.XDG_STATE_HOME
  process.env.E2E_AUTH_CACHE_DIR = xdgEnv.XDG_CACHE_HOME
  process.env.E2E_BROWSER_STATE_PATH = storageStatePath
  /* eslint-enable require-atomic-updates */

  globalLog('auth', `global setup done, config at ${xdgEnv.XDG_CONFIG_HOME}`)
}

/** Navigate to a URL and dismiss the account picker if it appears. */
async function visitAndHandleAccountPicker(page: Page, url: string, email: string) {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  if (isAccountsShopifyUrl(page.url())) {
    const accountButton = page.locator(`text=${email}`).first()
    if (await accountButton.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false)) {
      await accountButton.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
}

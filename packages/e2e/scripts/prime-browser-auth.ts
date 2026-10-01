/* eslint-disable no-console, no-restricted-imports */

/**
 * Prime CLI auth and Playwright browser storage state for standalone E2E maintenance scripts.
 *
 * Playwright global setup creates this state before test workers start, but
 * standalone GitHub Actions jobs need a small auth-only entrypoint so follow-up
 * cleanup jobs can reuse Business Platform tokens and browser cookies without each cleanup operation going
 * through Shopify Accounts again.
 */

import {config} from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'
import {chromium} from '@playwright/test'
import {BROWSER_TIMEOUT, CLI_TIMEOUT} from '../setup/constants.js'
import {executables} from '../setup/env.js'
import {isVisibleWithin} from '../setup/browser.js'
import {completeLogin} from '../helpers/browser-login.js'
import {addLoadtestHeader} from '../helpers/loadtest-header.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {execa} from 'execa'
import type {Page} from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (
  !process.env.E2E_ACCOUNT_EMAIL ||
  !process.env.E2E_ACCOUNT_PASSWORD ||
  !process.env.E2E_ORG_ID ||
  !process.env.E2E_LOADTEST_HEADER
) {
  config({path: path.resolve(__dirname, '../.env')})
}

interface PrimeBrowserAuthOptions {
  /** Playwright browser storage state path (default: E2E_BROWSER_STATE_PATH or global-auth path) */
  storageStatePath?: string
  /** Show browser window */
  headed?: boolean
  /** Organization ID (default: from E2E_ORG_ID env) */
  orgId?: string
}

function isAccountsShopifyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === 'accounts.shopify.com'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

function defaultAuthDir(): string {
  const tmpBase = process.env.E2E_TEMP_DIR ?? path.resolve(__dirname, '../../../.e2e-tmp')
  return path.join(tmpBase, 'global-auth')
}

function defaultStorageStatePath(): string {
  return path.join(defaultAuthDir(), 'browser-storage-state.json')
}

function cleanupAuthEnv(storageStatePath: string): NodeJS.ProcessEnv {
  const authDir = defaultAuthDir()
  return {
    ...process.env,
    XDG_DATA_HOME: path.join(authDir, 'XDG_DATA_HOME'),
    XDG_CONFIG_HOME: path.join(authDir, 'XDG_CONFIG_HOME'),
    XDG_STATE_HOME: path.join(authDir, 'XDG_STATE_HOME'),
    XDG_CACHE_HOME: path.join(authDir, 'XDG_CACHE_HOME'),
    E2E_BROWSER_STATE_PATH: storageStatePath,
    SHOPIFY_RUN_AS_USER: '0',
    SHOPIFY_CLI_NO_ANALYTICS: '1',
    NODE_OPTIONS: '',
    CI: '1',
    SHOPIFY_FLAG_CLIENT_ID: undefined,
  }
}

function persistAuthEnvForLaterSteps(env: NodeJS.ProcessEnv) {
  const githubEnv = process.env.GITHUB_ENV
  if (!githubEnv) return

  const keys = ['XDG_DATA_HOME', 'XDG_CONFIG_HOME', 'XDG_STATE_HOME', 'E2E_BROWSER_STATE_PATH']
  fs.appendFileSync(githubEnv, keys.map((key) => `${key}=${env[key] ?? ''}`).join('\n') + '\n')
}

export async function primeBrowserAuthStorage(opts: PrimeBrowserAuthOptions = {}): Promise<string> {
  const email = process.env.E2E_ACCOUNT_EMAIL
  const password = process.env.E2E_ACCOUNT_PASSWORD
  const orgId = opts.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const storageStatePath = opts.storageStatePath ?? process.env.E2E_BROWSER_STATE_PATH ?? defaultStorageStatePath()

  if (!email || !password) {
    throw new Error('E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are required')
  }

  if (!orgId) {
    throw new Error('E2E_ORG_ID is required')
  }

  const authEnv = cleanupAuthEnv(storageStatePath)
  for (const dir of [
    path.dirname(storageStatePath),
    authEnv.XDG_DATA_HOME,
    authEnv.XDG_CONFIG_HOME,
    authEnv.XDG_STATE_HOME,
    authEnv.XDG_CACHE_HOME,
  ]) {
    if (dir) fs.mkdirSync(dir, {recursive: true})
  }
  persistAuthEnvForLaterSteps(authEnv)

  const browser = await chromium.launch({headless: !opts.headed})
  try {
    const context = await browser.newContext()
    await addLoadtestHeader(context)
    context.setDefaultTimeout(BROWSER_TIMEOUT.max)
    context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
    const page = await context.newPage()

    console.log('[prime-browser-auth] Logging in...')
    await primeCliAuth(page, email, password, authEnv)

    await attemptVisitAndHandleAccountPicker(page, 'https://admin.shopify.com/', email, 'admin')
    await attemptVisitAndHandleAccountPicker(
      page,
      `https://dev.shopify.com/dashboard/${orgId}/apps`,
      email,
      'dev dashboard',
    )

    await context.storageState({path: storageStatePath})
    console.log(`[prime-browser-auth] Browser storage state saved to ${storageStatePath}`)
    return storageStatePath
  } finally {
    await browser.close()
  }
}

async function primeCliAuth(page: Page, email: string, password: string, env: NodeJS.ProcessEnv) {
  await execa('node', [executables.cli, 'auth', 'logout'], {
    env,
    reject: false,
  })

  const nodePty = await import('node-pty')
  const spawnEnv: {[key: string]: string} = {}
  for (const [key, value] of Object.entries(env)) {
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
  })

  try {
    await waitForText(() => output, 'link to start the auth process', CLI_TIMEOUT.short)

    const stripped = stripAnsi(output)
    const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
    if (!urlMatch) {
      throw new Error('[prime-browser-auth] could not find login URL in Shopify auth output')
    }

    await completeLogin(page, urlMatch[0], email, password)
    await waitForText(() => output, 'Logged in', BROWSER_TIMEOUT.max)
  } finally {
    try {
      ptyProcess.kill()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_error) {
      // Process may already be dead.
    }
  }
}

async function attemptVisitAndHandleAccountPicker(page: Page, url: string, email: string, label: string) {
  try {
    await visitAndHandleAccountPicker(page, url, email)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    console.warn(
      `[prime-browser-auth] Browser session prewarm for ${label} failed: ${err instanceof Error ? err.message : err}`,
    )
  }
}

/** Navigate to a URL and dismiss the account picker if it appears. */
async function visitAndHandleAccountPicker(page: Page, url: string, email: string) {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  if (isAccountsShopifyUrl(page.url())) {
    const accountButton = page.locator(`text=${email}`).first()
    if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.long)) {
      await accountButton.click()
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  primeBrowserAuthStorage({headed: process.argv.includes('--headed')}).catch((err) => {
    console.error('[prime-browser-auth] Fatal error:', err)
    process.exitCode = 1
  })
}

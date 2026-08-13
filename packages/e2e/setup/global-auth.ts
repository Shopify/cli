/**
 * Authenticates once before the remote Playwright project starts.
 *
 * Auth artifacts are stored in a stable `global-auth/` dir. Workers copy
 * the session files into their own isolated XDG dirs.
 */

import {isVisibleWithin} from './browser.js'
import {executables, globalLog} from './env.js'
import {authStatePaths} from './auth-state.js'
import {AuthSetupError, readAuthConfig, retryAuthOperation, type AuthConfig} from './auth-diagnostics.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {addLoadtestHeader} from '../helpers/loadtest-header.js'
import {execa} from 'execa'
import {chromium, type Browser, type Page} from '@playwright/test'
import * as fs from 'fs'
import type {IPty} from 'node-pty'

function isAccountsShopifyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname === 'accounts.shopify.com'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

export async function prepareGlobalAuth() {
  const {authDir, storageStatePath, xdgEnv} = authStatePaths()
  const authConfig = readAuthConfig()
  globalLog('auth', 'starting')

  const processEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...xdgEnv,
    SHOPIFY_RUN_AS_USER: '0',
    SHOPIFY_CLI_NO_ANALYTICS: '1',
    NODE_OPTIONS: '',
    CI: '1',
    SHOPIFY_FLAG_CLIENT_ID: undefined,
  }

  try {
    await retryAuthOperation(
      async () => {
        resetAuthDirectories(authDir, xdgEnv)
        await authenticateOnce({authConfig, processEnv, storageStatePath})
      },
      {
        onRetry: (failure, nextAttempt) => {
          globalLog('auth', `retry stage=${failure.stage} reason=${failure.reason} next_attempt=${nextAttempt}`)
        },
      },
    )
  } catch (error) {
    const failure = error instanceof AuthSetupError ? error : new AuthSetupError('browser-login', 'unexpected-error')
    globalLog('auth', `failed stage=${failure.stage} reason=${failure.reason}`)
    throw failure
  }

  globalLog('auth', 'complete')
}

function resetAuthDirectories(authDir: string, xdgEnv: Record<string, string>): void {
  fs.rmSync(authDir, {recursive: true, force: true})
  fs.mkdirSync(authDir, {recursive: true})
  for (const directory of Object.values(xdgEnv)) {
    fs.mkdirSync(directory, {recursive: true})
  }
}

async function authenticateOnce({
  authConfig,
  processEnv,
  storageStatePath,
}: {
  authConfig: AuthConfig
  processEnv: NodeJS.ProcessEnv
  storageStatePath: string
}): Promise<void> {
  const {email, password} = authConfig

  await execa('node', [executables.cli, 'auth', 'logout'], {
    env: processEnv,
    reject: false,
  })

  const spawnEnv: {[key: string]: string} = {}
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) spawnEnv[key] = value
  }
  spawnEnv.CI = ''
  spawnEnv.CODESPACES = 'true'

  let ptyProcess: IPty
  try {
    const nodePty = await import('node-pty')
    ptyProcess = nodePty.spawn('node', [executables.cli, 'auth', 'login'], {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      env: spawnEnv,
    })
  } catch (_error) {
    throw new AuthSetupError('pty-startup', 'spawn-failed')
  }

  let output = ''
  ptyProcess.onData((data: string) => {
    output += data
  })

  try {
    try {
      await waitForText(() => output, 'link to start the auth process', CLI_TIMEOUT.short)
    } catch (_error) {
      throw new AuthSetupError('device-code-generation', 'timeout')
    }

    const stripped = stripAnsi(output)
    const urlMatch = stripped.match(/https:\/\/accounts\.shopify\.com\S+/)
    if (!urlMatch) {
      throw new AuthSetupError('device-code-generation', 'login-url-missing')
    }

    let browser: Browser
    try {
      browser = await chromium.launch({headless: !process.env.E2E_HEADED})
    } catch (_error) {
      throw new AuthSetupError('browser-login', 'browser-startup')
    }

    try {
      const context = await browser.newContext()
      await addLoadtestHeader(context)
      context.setDefaultTimeout(BROWSER_TIMEOUT.max)
      context.setDefaultNavigationTimeout(BROWSER_TIMEOUT.max)
      const page = await context.newPage()

      await completeLogin(page, urlMatch[0], email, password)

      try {
        await waitForText(() => output, 'Logged in', BROWSER_TIMEOUT.max)
      } catch (_error) {
        throw new AuthSetupError('browser-login', 'cli-confirmation-timeout')
      }

      await prewarmBrowserSession(page, authConfig)

      try {
        await context.storageState({path: storageStatePath})
      } catch (_error) {
        throw new AuthSetupError('session-prewarm', 'storage-state-write')
      }
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
}

async function prewarmBrowserSession(page: Page, authConfig: AuthConfig): Promise<void> {
  const destinations = [
    {url: 'https://admin.shopify.com/', label: 'admin'},
    {url: `https://dev.shopify.com/dashboard/${authConfig.orgId}/apps`, label: 'dev-dashboard'},
  ]

  for (const destination of destinations) {
    try {
      // Session cookies must be established in order on the same page.
      // eslint-disable-next-line no-await-in-loop
      await retryAuthOperation(
        () => visitAndHandleAccountPicker(page, destination.url, authConfig.email, destination.label),
        {
          onRetry: (failure, nextAttempt) => {
            globalLog('auth', `retry stage=${failure.stage} reason=${failure.reason} next_attempt=${nextAttempt}`)
          },
        },
      )
    } catch (error) {
      if (error instanceof AuthSetupError) {
        throw new AuthSetupError(error.stage, error.reason)
      }
      throw new AuthSetupError('session-prewarm', `${destination.label}-unexpected-error`)
    }
  }

  globalLog('auth', 'session prewarm complete')
}

async function visitAndHandleAccountPicker(page: Page, url: string, email: string, label: string) {
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded'})
  } catch (_error) {
    throw new AuthSetupError('session-prewarm', `${label}-page-load`)
  }

  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  if (isAccountsShopifyUrl(page.url())) {
    const accountButton = page.locator(`text=${email}`).first()
    if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.long)) {
      try {
        await accountButton.click()
      } catch (_error) {
        throw new AuthSetupError('session-prewarm', `${label}-account-picker`)
      }
      await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    }
  }
}

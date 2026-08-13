/**
 * Authenticates once before the remote Playwright project starts.
 *
 * Auth artifacts are stored in a stable `global-auth/` dir. Workers copy
 * the session files into their own isolated XDG dirs.
 */

import {isVisibleWithin} from './browser.js'
import {executables, globalLog} from './env.js'
import {authStatePaths} from './auth-state.js'
import {
  AuthSetupError,
  isExpectedAuthDestination,
  readAuthConfig,
  requireSuccessfulNavigation,
  runAuthStages,
  type AuthConfig,
} from './auth-diagnostics.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {waitForText} from '../helpers/wait-for-text.js'
import {completeLogin} from '../helpers/browser-login.js'
import {addLoadtestHeader} from '../helpers/loadtest-header.js'
import {execa} from 'execa'
import {chromium, type Browser, type BrowserContext, type Page} from '@playwright/test'
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

interface AuthenticatedBrowserSession {
  browser: Browser
  context: BrowserContext
  page: Page
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
    await runAuthStages({
      authenticate: async () => {
        resetAuthDirectories(authDir, xdgEnv)
        return authenticateOnce({authConfig, processEnv})
      },
      prewarm: async ({page}) => {
        await prewarmBrowserSession(page, authConfig)
      },
      complete: async ({context}) => {
        try {
          await context.storageState({path: storageStatePath})
        } catch (_error) {
          throw new AuthSetupError('session-prewarm', 'storage-state-write')
        }
      },
      dispose: async ({browser}) => browser.close(),
      onRetry: (failure, nextAttempt) => {
        globalLog('auth', `retry stage=${failure.stage} reason=${failure.reason} next_attempt=${nextAttempt}`)
      },
    })
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
}: {
  authConfig: AuthConfig
  processEnv: NodeJS.ProcessEnv
}): Promise<AuthenticatedBrowserSession> {
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

      return {browser, context, page}
    } catch (error) {
      await browser.close()
      throw error
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
    {url: 'https://admin.shopify.com/', label: 'admin', hostname: 'admin.shopify.com'},
    {
      url: `https://dev.shopify.com/dashboard/${authConfig.orgId}/apps`,
      label: 'dev-dashboard',
      hostname: 'dev.shopify.com',
      pathnamePrefix: `/dashboard/${authConfig.orgId}/apps`,
    },
  ]

  for (const destination of destinations) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await visitAndHandleAccountPicker(page, destination, authConfig.email)
    } catch (error) {
      if (error instanceof AuthSetupError) {
        throw new AuthSetupError(error.stage, error.reason)
      }
      throw new AuthSetupError('session-prewarm', `${destination.label}-unexpected-error`)
    }
  }

  globalLog('auth', 'session prewarm complete')
}

async function visitAndHandleAccountPicker(
  page: Page,
  destination: {url: string; label: string; hostname: string; pathnamePrefix?: string},
  email: string,
) {
  const {url, label, hostname, pathnamePrefix} = destination
  await requireSuccessfulNavigation(
    () => page.goto(url, {waitUntil: 'domcontentloaded'}),
    'session-prewarm',
    `${label}-page-load`,
  )

  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  if (isAccountsShopifyUrl(page.url())) {
    const accountButton = page.locator(`text=${email}`).first()
    if (await isVisibleWithin(accountButton, BROWSER_TIMEOUT.long)) {
      try {
        await Promise.all([
          page.waitForURL((currentUrl) => isExpectedAuthDestination(currentUrl.href, hostname, pathnamePrefix), {
            timeout: BROWSER_TIMEOUT.max,
          }),
          accountButton.click(),
        ])
      } catch (_error) {
        throw new AuthSetupError('session-prewarm', `${label}-account-picker`)
      }
    }
  }

  if (!isExpectedAuthDestination(page.url(), hostname, pathnamePrefix)) {
    throw new AuthSetupError('session-prewarm', `${label}-unexpected-url`)
  }
}

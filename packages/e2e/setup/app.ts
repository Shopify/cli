/* eslint-disable no-restricted-imports, no-await-in-loop */
import {authFixture} from './auth.js'
import {navigateToDashboard} from './browser.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {completeLogin} from '../helpers/browser-login.js'
import {updateTomlValues} from '@shopify/toml-patch'
import * as toml from '@iarna/toml'
import * as path from 'path'
import * as fs from 'fs'
import type {CLIContext, CLIProcess, ExecResult} from './cli.js'
import type {BrowserContext} from './browser.js'

// ---------------------------------------------------------------------------
// CLI helpers — thin wrappers around cli.exec()
// ---------------------------------------------------------------------------

export async function createApp(ctx: {
  cli: CLIProcess
  parentDir: string
  name?: string
  template?: 'reactRouter' | 'remix' | 'none'
  flavor?: 'javascript' | 'typescript'
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
  orgId?: string
}): Promise<ExecResult & {appDir: string}> {
  const {cli, parentDir} = ctx
  const name = ctx.name ?? 'e2e-test-app'
  const template = ctx.template ?? 'reactRouter'
  const packageManager =
    ctx.packageManager ?? (process.env.E2E_PACKAGE_MANAGER as 'npm' | 'yarn' | 'pnpm' | 'bun') ?? 'npm'

  const args = [
    '--name',
    name,
    '--path',
    parentDir,
    '--package-manager',
    packageManager,
    '--local',
    '--template',
    template,
  ]
  if (ctx.orgId) args.push('--organization-id', ctx.orgId)
  if (ctx.flavor) args.push('--flavor', ctx.flavor)

  const result = await cli.execCreateApp(args, {
    env: {FORCE_COLOR: '0'},
    timeout: CLI_TIMEOUT.long,
  })

  let appDir = ''
  if (result.exitCode === 0) {
    const allOutput = `${result.stdout}\n${result.stderr}`
    const match = allOutput.match(/([\w-]+) is ready for you to build!/)

    if (match?.[1]) {
      appDir = path.join(parentDir, match[1])
    } else {
      const entries = fs.readdirSync(parentDir, {withFileTypes: true})
      const appEntry = entries.find(
        (entry) => entry.isDirectory() && fs.existsSync(path.join(parentDir, entry.name, 'shopify.app.toml')),
      )
      if (appEntry) {
        appDir = path.join(parentDir, appEntry.name)
      } else {
        throw new Error(
          `Could not find created app directory in ${parentDir}.\n` +
            `Exit code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
        )
      }
    }

    // Ensure npm doesn't enforce frozen lockfile
    const npmrcPath = path.join(appDir, '.npmrc')
    if (!fs.existsSync(npmrcPath)) fs.writeFileSync(npmrcPath, '')
    fs.appendFileSync(npmrcPath, 'frozen-lockfile=false\n')
  }

  return {...result, appDir}
}

// ---------------------------------------------------------------------------
// Fixture helpers — TOML manipulation for test setup
// ---------------------------------------------------------------------------

/**
 * Read the client_id from a shopify.app.toml file.
 */
export function extractClientId(appDir: string): string {
  const tomlPath = path.join(appDir, 'shopify.app.toml')
  const parsed = toml.parse(fs.readFileSync(tomlPath, 'utf8'))
  const clientId = parsed.client_id as string | undefined
  if (!clientId) {
    throw new Error(`Could not find client_id in ${tomlPath}`)
  }
  return clientId
}

/**
 * Overwrite a created app's shopify.app.toml with a fixture TOML template.
 * Uses toml-patch to surgically set client_id and name while
 * preserving comments and formatting in the fixture file.
 */
export function injectFixtureToml(appDir: string, fixtureTomlContent: string, name: string): void {
  const clientId = extractClientId(appDir)
  const patched = updateTomlValues(fixtureTomlContent, [
    [['client_id'], clientId],
    [['name'], name],
  ])
  fs.writeFileSync(path.join(appDir, 'shopify.app.toml'), patched)
}

export async function generateExtension(
  ctx: CLIContext & {
    name: string
    template: string
    flavor?: string
  },
): Promise<ExecResult> {
  const args = ['app', 'generate', 'extension', '--name', ctx.name, '--path', ctx.appDir, '--template', ctx.template]
  if (ctx.flavor) args.push('--flavor', ctx.flavor)
  return ctx.cli.exec(args, {timeout: CLI_TIMEOUT.long})
}

export async function buildApp(ctx: CLIContext): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'build', '--path', ctx.appDir], {timeout: CLI_TIMEOUT.long})
}

export async function deployApp(
  ctx: CLIContext & {
    version?: string
    message?: string
    config?: string
    force?: boolean
    noBuild?: boolean
  },
): Promise<ExecResult> {
  const args = ['app', 'deploy', '--path', ctx.appDir]
  if (ctx.force ?? true) args.push('--force')
  if (ctx.noBuild) args.push('--no-build')
  if (ctx.version) args.push('--version', ctx.version)
  if (ctx.message) args.push('--message', ctx.message)
  if (ctx.config) args.push('--config', ctx.config)
  return ctx.cli.exec(args, {timeout: CLI_TIMEOUT.long})
}

export async function appInfo(ctx: CLIContext): Promise<{
  packageManager: string
  allExtensions: {
    configuration: {name: string; type: string; handle?: string}
    directory: string
    outputPath: string
    entrySourceFilePath: string
  }[]
}> {
  const result = await ctx.cli.exec(['app', 'info', '--path', ctx.appDir, '--json'])
  if (result.exitCode !== 0) {
    throw new Error(`app info failed (exit ${result.exitCode}):\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  }
  return JSON.parse(result.stdout)
}

export async function functionBuild(ctx: CLIContext): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'function', 'build', '--path', ctx.appDir], {timeout: CLI_TIMEOUT.medium})
}

export async function functionRun(
  ctx: CLIContext & {
    inputPath: string
  },
): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'function', 'run', '--path', ctx.appDir, '--input', ctx.inputPath], {
    timeout: CLI_TIMEOUT.short,
  })
}

export async function versionsList(ctx: CLIContext): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'versions', 'list', '--path', ctx.appDir, '--json'], {
    timeout: CLI_TIMEOUT.short,
  })
}

export async function configLink(
  ctx: CLIContext & {
    clientId: string
  },
): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'config', 'link', '--path', ctx.appDir, '--client-id', ctx.clientId], {
    timeout: CLI_TIMEOUT.medium,
  })
}

// ---------------------------------------------------------------------------
// Per-test teardown — find app on dashboard, uninstall if needed, delete
// ---------------------------------------------------------------------------

/**
 * Best-effort per-test teardown.
 *
 * Flow:
 *   0. Log browser into Shopify (browser page isn't authenticated on dev.shopify.com)
 *   1. Navigate to dashboard → search for app by name → get app URL
 *   2. If installed → go to store admin via FQDN → uninstall
 *   3. Go to app settings → delete
 */
export async function teardownApp(
  ctx: BrowserContext & {
    appName: string
    email?: string
    orgId?: string
    storeFqdn?: string
  },
): Promise<void> {
  try {
    const {browserPage} = ctx
    const storeFqdn = ctx.storeFqdn ?? (process.env.E2E_STORE_FQDN ?? '').trim()
    const orgId = ctx.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
    const email = ctx.email ?? process.env.E2E_ACCOUNT_EMAIL
    const password = process.env.E2E_ACCOUNT_PASSWORD
    const debug = process.env.DEBUG === '1'

    if (debug) process.stdout.write(`[e2e] teardown: ${ctx.appName}\n`)

    // Step 0: Log the browser into Shopify
    if (email && password) {
      try {
        await completeLogin(browserPage, 'https://accounts.shopify.com/lookup', email, password)
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_err) {
        // Login may fail if already logged in — continue anyway
      }
    }

    // Step 1: Navigate to dashboard and search for the app
    await navigateToDashboard({browserPage, email, orgId})
    const searchUrl = `${browserPage.url()}?search=${encodeURIComponent(ctx.appName)}`
    await browserPage.goto(searchUrl, {waitUntil: 'domcontentloaded'})
    await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

    let appHref: string | null = null
    let hasInstalls = false
    const allLinks = await browserPage.locator('a[href*="/apps/"]').all()
    for (const link of allLinks) {
      const text = (await link.textContent()) ?? ''
      if (text.includes(ctx.appName)) {
        appHref = await link.getAttribute('href')
        // Check install count from the card text (e.g., "E2E-deploy-123 1 install • ...")
        const installMatch = text.match(/(\d+)\s+install/i)
        hasInstalls = installMatch ? parseInt(installMatch[1]!, 10) > 0 : false
        break
      }
    }

    if (!appHref) {
      if (debug) process.stdout.write(`[e2e] teardown: "${ctx.appName}" not found on dashboard\n`)
      return
    }

    const appUrl = appHref.startsWith('http') ? appHref : `https://dev.shopify.com${appHref}`

    // Step 2: If the app is installed, uninstall via direct store admin URL
    if (hasInstalls && storeFqdn) {
      try {
        if (debug) process.stdout.write(`[e2e] teardown: uninstalling from ${storeFqdn}\n`)
        const storeSlug = storeFqdn.replace('.myshopify.com', '')
        await browserPage.goto(`https://admin.shopify.com/store/${storeSlug}/settings/apps`, {
          waitUntil: 'domcontentloaded',
        })
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.long)

        // Dismiss any Dev Console dialog
        const cancelBtn = browserPage.locator('button:has-text("Cancel")')
        if (await cancelBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
          await cancelBtn.click()
          await browserPage.waitForTimeout(BROWSER_TIMEOUT.short)
        }

        const appSpan = browserPage.locator(`span:has-text("${ctx.appName}"):not([class*="Polaris"])`).first()
        if (await appSpan.isVisible({timeout: BROWSER_TIMEOUT.long}).catch(() => false)) {
          await appSpan.locator('xpath=./following::button[1]').click()
          await browserPage.waitForTimeout(BROWSER_TIMEOUT.short)

          const uninstallOpt = browserPage.locator('text=Uninstall').last()
          if (await uninstallOpt.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
            await uninstallOpt.click()
            await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

            const confirmBtn = browserPage.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
            if (await confirmBtn.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
              await confirmBtn.click()
              await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
            }
          }
          if (debug) process.stdout.write('[e2e] teardown: uninstalled\n')
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_err) {
        // Best-effort — continue to delete
      }
    }

    // Step 3: Delete from app settings page
    try {
      await browserPage.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
      await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

      const deleteButton = browserPage.locator('button:has-text("Delete app")').first()
      for (let attempt = 1; attempt <= 5; attempt++) {
        const isDisabled = await deleteButton.getAttribute('disabled').catch(() => 'true')
        if (!isDisabled) break
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.long)
        await browserPage.reload({waitUntil: 'domcontentloaded'})
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
      }

      await deleteButton.click({timeout: BROWSER_TIMEOUT.long})
      await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)

      const confirmInput = browserPage.locator('input[type="text"]').last()
      if (await confirmInput.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
        await confirmInput.fill('DELETE')
        await browserPage.waitForTimeout(BROWSER_TIMEOUT.short)
      }

      const confirmButton = browserPage.locator('button:has-text("Delete app")').last()
      await confirmButton.click()
      await browserPage.waitForTimeout(BROWSER_TIMEOUT.medium)
      if (debug) process.stdout.write(`[e2e] teardown: deleted`)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (err) {
      if (debug) {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`[e2e] Teardown delete failed for ${ctx.appName}: ${msg}\n`)
      }
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    if (process.env.DEBUG === '1') {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[e2e] Teardown failed for ${ctx.appName}: ${msg}\n`)
    }
  }
}

// ---------------------------------------------------------------------------
// Fixture — ensures auth runs before tests. Tests use helper functions directly.
// ---------------------------------------------------------------------------

export const appTestFixture = authFixture.extend<{authReady: void}>({
  // Auto-trigger authLogin so the OAuth session is available for all app tests
  authReady: [
    async ({authLogin: _authLogin}: {authLogin: void}, use: () => Promise<void>) => {
      await use()
    },
    {auto: true},
  ],
})

/* eslint-disable no-restricted-imports, no-await-in-loop */
import {authFixture} from './auth.js'
import {navigateToDashboard} from './browser.js'
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
    timeout: 5 * 60 * 1000,
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
  const toml = fs.readFileSync(path.join(appDir, 'shopify.app.toml'), 'utf8')
  const match = toml.match(/client_id\s*=\s*"([^"]+)"/)
  if (!match?.[1]) {
    throw new Error(`Could not find client_id in ${path.join(appDir, 'shopify.app.toml')}`)
  }
  return match[1]
}

/**
 * Overwrite a created app's shopify.app.toml with a fixture TOML template.
 * The template should contain `__CLIENT_ID__` and `__NAME__` placeholders which get
 * replaced with the app's real client_id and the provided name.
 */
export function injectFixtureToml(appDir: string, fixtureTomlContent: string, name: string): void {
  const clientId = extractClientId(appDir)
  const toml = fixtureTomlContent.replace(/__CLIENT_ID__/g, clientId).replace(/__NAME__/g, name)
  fs.writeFileSync(path.join(appDir, 'shopify.app.toml'), toml)
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
  return ctx.cli.exec(args, {timeout: 5 * 60 * 1000})
}

export async function buildApp(ctx: CLIContext): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'build', '--path', ctx.appDir], {timeout: 5 * 60 * 1000})
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
  return ctx.cli.exec(args, {timeout: 5 * 60 * 1000})
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
  return ctx.cli.exec(['app', 'function', 'build', '--path', ctx.appDir], {timeout: 3 * 60 * 1000})
}

export async function functionRun(
  ctx: CLIContext & {
    inputPath: string
  },
): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'function', 'run', '--path', ctx.appDir, '--input', ctx.inputPath], {
    timeout: 60 * 1000,
  })
}

export async function versionsList(ctx: CLIContext): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'versions', 'list', '--path', ctx.appDir, '--json'], {
    timeout: 60 * 1000,
  })
}

export async function configLink(
  ctx: CLIContext & {
    clientId: string
  },
): Promise<ExecResult> {
  return ctx.cli.exec(['app', 'config', 'link', '--path', ctx.appDir, '--client-id', ctx.clientId], {
    timeout: 2 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Browser helpers — app-specific dashboard automation
// ---------------------------------------------------------------------------

/** Find apps matching a name pattern on the dashboard. Call navigateToDashboard first. */
export async function findAppsOnDashboard(
  ctx: BrowserContext & {
    namePattern: string
  },
): Promise<{name: string; url: string}[]> {
  const appCards = await ctx.browserPage.locator('a[href*="/apps/"]').all()
  const apps: {name: string; url: string}[] = []

  for (const card of appCards) {
    const href = await card.getAttribute('href')
    const text = await card.textContent()
    if (!href || !text || !href.match(/\/apps\/\d+/)) continue

    const name = text.split(/\d+\s+install/i)[0]?.trim() ?? text.split('\n')[0]?.trim() ?? text.trim()
    if (!name || name.length > 200) continue
    if (!name.includes(ctx.namePattern)) continue

    const url = href.startsWith('http') ? href : `https://dev.shopify.com${href}`
    apps.push({name, url})
  }

  return apps
}

/** Uninstall an app from all stores it's installed on. Returns true if fully uninstalled. */
export async function uninstallApp(
  ctx: BrowserContext & {
    appUrl: string
    appName: string
    orgId?: string
  },
): Promise<boolean> {
  const {browserPage, appUrl, appName} = ctx
  const orgId = ctx.orgId ?? (process.env.E2E_ORG_ID ?? '').trim()

  await browserPage.goto(`${appUrl}/installs`, {waitUntil: 'domcontentloaded'})
  await browserPage.waitForTimeout(3000)

  const rows = await browserPage.locator('table tbody tr').all()
  const storeNames: string[] = []
  for (const row of rows) {
    const firstCell = row.locator('td').first()
    const text = (await firstCell.textContent())?.trim()
    if (text && !text.toLowerCase().includes('no installed')) storeNames.push(text)
  }

  if (storeNames.length === 0) return true

  let allUninstalled = true
  for (const storeName of storeNames) {
    try {
      // Navigate to store admin via the dev dashboard dropdown
      const dashboardUrl = orgId
        ? `https://dev.shopify.com/dashboard/${orgId}/apps`
        : 'https://dev.shopify.com/dashboard'
      let navigated = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        await browserPage.goto(dashboardUrl, {waitUntil: 'domcontentloaded'})
        await browserPage.waitForTimeout(3000)

        const pageText = (await browserPage.textContent('body')) ?? ''
        if (pageText.includes('500') || pageText.includes('Internal Server Error')) continue

        const orgButton = browserPage.locator('header button').last()
        if (!(await orgButton.isVisible({timeout: 5000}).catch(() => false))) continue
        await orgButton.click()
        await browserPage.waitForTimeout(1000)

        const storeLink = browserPage.locator('a, button').filter({hasText: storeName}).first()
        if (!(await storeLink.isVisible({timeout: 5000}).catch(() => false))) continue
        await storeLink.click()
        await browserPage.waitForTimeout(3000)
        navigated = true
        break
      }

      if (!navigated) {
        allUninstalled = false
        continue
      }

      // Navigate to store's apps settings page
      const storeAdminUrl = browserPage.url()
      await browserPage.goto(`${storeAdminUrl.replace(/\/$/, '')}/settings/apps`, {waitUntil: 'domcontentloaded'})
      await browserPage.waitForTimeout(5000)

      // Dismiss any Dev Console dialog
      const cancelButton = browserPage.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible({timeout: 2000}).catch(() => false)) {
        await cancelButton.click()
        await browserPage.waitForTimeout(1000)
      }

      // Find the app in the installed list (plain span, not Dev Console's Polaris text)
      const appSpan = browserPage.locator(`span:has-text("${appName}"):not([class*="Polaris"])`).first()
      if (!(await appSpan.isVisible({timeout: 5000}).catch(() => false))) {
        allUninstalled = false
        continue
      }

      // Click the ⋯ menu button next to the app name
      const menuButton = appSpan.locator('xpath=./following::button[1]')
      await menuButton.click()
      await browserPage.waitForTimeout(1000)

      // Click "Uninstall" in the dropdown menu
      const uninstallOption = browserPage.locator('text=Uninstall').last()
      if (!(await uninstallOption.isVisible({timeout: 3000}).catch(() => false))) {
        allUninstalled = false
        continue
      }
      await uninstallOption.click()
      await browserPage.waitForTimeout(2000)

      // Handle confirmation dialog
      const confirmButton = browserPage.locator('button:has-text("Uninstall"), button:has-text("Confirm")').last()
      if (await confirmButton.isVisible({timeout: 3000}).catch(() => false)) {
        await confirmButton.click()
        await browserPage.waitForTimeout(3000)
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (_err) {
      allUninstalled = false
    }
  }

  return allUninstalled
}

/** Delete an app from the partner dashboard. Should be uninstalled first. */
export async function deleteApp(
  ctx: BrowserContext & {
    appUrl: string
  },
): Promise<void> {
  const {browserPage, appUrl} = ctx

  await browserPage.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await browserPage.waitForTimeout(3000)

  // Retry if delete button is disabled (uninstall propagation delay)
  const deleteButton = browserPage.locator('button:has-text("Delete app")').first()
  for (let attempt = 1; attempt <= 5; attempt++) {
    await deleteButton.scrollIntoViewIfNeeded()
    const isDisabled = await deleteButton.getAttribute('disabled')
    if (!isDisabled) break
    await browserPage.waitForTimeout(5000)
    await browserPage.reload({waitUntil: 'domcontentloaded'})
    await browserPage.waitForTimeout(3000)
  }

  await deleteButton.click({timeout: 10_000})
  await browserPage.waitForTimeout(2000)

  // Handle confirmation dialog — may need to type "DELETE"
  const confirmInput = browserPage.locator('input[type="text"]').last()
  if (await confirmInput.isVisible({timeout: 3000}).catch(() => false)) {
    await confirmInput.fill('DELETE')
    await browserPage.waitForTimeout(500)
  }

  const confirmButton = browserPage.locator('button:has-text("Delete app")').last()
  await confirmButton.click()
  await browserPage.waitForTimeout(3000)
}

/** Best-effort teardown: find app on dashboard by name, uninstall from all stores, delete. */
export async function teardownApp(
  ctx: BrowserContext & {
    appName: string
    email?: string
    orgId?: string
  },
): Promise<void> {
  try {
    await navigateToDashboard(ctx)
    const apps = await findAppsOnDashboard({browserPage: ctx.browserPage, namePattern: ctx.appName})
    for (const app of apps) {
      try {
        await uninstallApp({browserPage: ctx.browserPage, appUrl: app.url, appName: app.name, orgId: ctx.orgId})
        await deleteApp({browserPage: ctx.browserPage, appUrl: app.url})
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (err) {
        // Best-effort per app — continue teardown of remaining apps
        if (process.env.DEBUG === '1') {
          const msg = err instanceof Error ? err.message : String(err)
          process.stderr.write(`[e2e] Teardown failed for app ${app.name}: ${msg}\n`)
        }
      }
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    // Best-effort — don't fail the test if teardown fails
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

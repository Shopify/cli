/* eslint-disable no-restricted-imports, no-await-in-loop */
import {authFixture} from './auth.js'
import {navigateToDashboard} from './browser.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {updateTomlValues} from '@shopify/toml-patch'
import * as toml from '@iarna/toml'
import * as path from 'path'
import * as fs from 'fs'
import type {CLIContext, CLIProcess, ExecResult} from './cli.js'
import type {Page} from '@playwright/test'

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
// Dev dashboard browser actions — find and delete apps
// ---------------------------------------------------------------------------

/** Search dev dashboard for an app by name. Returns the app URL or null. */
export async function findAppOnDevDashboard(page: Page, appName: string, orgId?: string): Promise<string | null> {
  const org = orgId ?? (process.env.E2E_ORG_ID ?? '').trim()
  const email = process.env.E2E_ACCOUNT_EMAIL

  await navigateToDashboard({browserPage: page, email, orgId: org})

  // Scan current page + pagination for the app

  while (true) {
    const allLinks = await page.locator('a[href*="/apps/"]').all()
    for (const link of allLinks) {
      const text = (await link.textContent()) ?? ''
      if (text.includes(appName)) {
        const href = await link.getAttribute('href')
        if (href) return href.startsWith('http') ? href : `https://dev.shopify.com${href}`
      }
    }

    // Check for next page
    const nextLink = page.locator('a[href*="next_cursor"]').first()
    if (!(await nextLink.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false))) break
    const nextHref = await nextLink.getAttribute('href')
    if (!nextHref) break
    const nextUrl = nextHref.startsWith('http') ? nextHref : `https://dev.shopify.com${nextHref}`
    await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  return null
}

/** Delete an app from its dev dashboard settings page. Returns true if deleted, false if not. */
export async function deleteAppFromDevDashboard(page: Page, appUrl: string): Promise<boolean> {
  // Step 1: Navigate to settings page
  await page.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Step 2: Wait for "Delete app" button to be enabled, then click (retry step 1+2 on failure)
  const deleteAppBtn = page.locator('button:has-text("Delete app")').first()
  for (let attempt = 1; attempt <= 5; attempt++) {
    const isDisabled = await deleteAppBtn.getAttribute('disabled').catch(() => 'true')
    if (!isDisabled) break
    await page.waitForTimeout(BROWSER_TIMEOUT.long)
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  await deleteAppBtn.click({timeout: BROWSER_TIMEOUT.long})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Step 3: Type "DELETE" in confirmation input (retry step 2+3 if input not visible)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const confirmInput = page.locator('input[type="text"]').last()
    if (await confirmInput.isVisible({timeout: BROWSER_TIMEOUT.medium}).catch(() => false)) {
      await confirmInput.fill('DELETE')
      await page.waitForTimeout(BROWSER_TIMEOUT.short)
      break
    }
    if (attempt === 3) break
    // Retry: re-click the delete button to reopen dialog
    await page.keyboard.press('Escape')
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
    await deleteAppBtn.click({timeout: BROWSER_TIMEOUT.long})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }

  // Step 4: Click confirm (retry step 3+4 if button is disabled)
  const confirmAppBtn = page.locator('button:has-text("Delete app")').last()
  for (let attempt = 1; attempt <= 3; attempt++) {
    const isDisabled = await confirmAppBtn
      .evaluate((el) => el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled'))
      .catch(() => true)
    if (!isDisabled) break
    if (attempt === 3) break
    // Retry: re-fill the input
    const confirmInput = page.locator('input[type="text"]').last()
    await confirmInput.fill('DELETE')
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  const urlBefore = page.url()
  await confirmAppBtn.click({force: true})

  // Wait for page to navigate away after deletion
  try {
    await page.waitForURL((url) => url.toString() !== urlBefore, {timeout: BROWSER_TIMEOUT.max})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (_err) {
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  }
  return page.url() !== urlBefore
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

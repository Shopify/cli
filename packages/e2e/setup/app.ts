/* eslint-disable no-restricted-imports, no-await-in-loop */
import {authFixture} from './auth.js'
import {getLastPageStatus, isVisibleWithin, navigateToDashboard, refreshIfPageError} from './browser.js'
import {CLI_TIMEOUT, BROWSER_TIMEOUT} from './constants.js'
import {updateTomlValues} from '@shopify/toml-patch'
import * as toml from '@iarna/toml'
import * as path from 'path'
import * as fs from 'fs'
import type {CLIContext, CLIProcess, ExecResult} from './cli.js'
import type {Page} from '@playwright/test'

/**
 * Race the given promise builders. When the winner resolves, losers are
 * cancelled via `AbortController.abort()` so their timers and `outputWaiters`
 * entries inside `waitForOutput` are freed immediately rather than lingering
 * until they hit their own timeout. Loser rejections are swallowed so they
 * don't surface as unhandled promise rejections.
 */
async function raceWaiters<T>(build: (signal: AbortSignal) => Promise<T>[]): Promise<T> {
  const ctrl = new AbortController()
  const promises = build(ctrl.signal)
  promises.forEach((promise) => promise.catch(() => {}))
  try {
    return await Promise.race(promises)
  } finally {
    ctrl.abort()
  }
}

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
    ctx.packageManager ?? (process.env.E2E_PACKAGE_MANAGER as 'npm' | 'yarn' | 'pnpm' | 'bun') ?? 'pnpm'
  // reactRouter/remix both require a --flavor or they'll hang on the language
  // prompt in non-interactive runs. Default to javascript when template needs
  // it. For `--template none` (extension-only) flavor is ignored.
  const flavor = ctx.flavor ?? (template === 'none' ? undefined : 'javascript')

  const args = ['--template', template]
  if (flavor) args.push('--flavor', flavor)
  args.push('--name', name, '--package-manager', packageManager, '--local')
  if (ctx.orgId) args.push('--organization-id', ctx.orgId)
  args.push('--path', parentDir)

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
  const args = ['app', 'generate', 'extension', '--template', ctx.template]
  if (ctx.flavor) args.push('--flavor', ctx.flavor)
  args.push('--name', ctx.name, '--path', ctx.appDir)
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
  const args = ['app', 'deploy']
  if (ctx.version) args.push('--version', ctx.version)
  if (ctx.message) args.push('--message', ctx.message)
  if (ctx.config) args.push('--config', ctx.config)
  if (ctx.force ?? true) args.push('--force')
  if (ctx.noBuild) args.push('--no-build')
  args.push('--path', ctx.appDir)
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
  const result = await ctx.cli.exec(['app', 'info', '--json', '--path', ctx.appDir])
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
  return ctx.cli.exec(['app', 'function', 'run', '--input', ctx.inputPath, '--path', ctx.appDir], {
    timeout: CLI_TIMEOUT.short,
  })
}

export async function versionsList(
  ctx: CLIContext & {
    config?: string
  },
): Promise<ExecResult> {
  const args = ['app', 'versions', 'list', '--json']
  if (ctx.config) args.push('--config', ctx.config)
  args.push('--path', ctx.appDir)
  return ctx.cli.exec(args, {timeout: CLI_TIMEOUT.short})
}

/**
 * Run `app config link` to create a brand-new app on Shopify interactively.
 * Answers the prompts:
 *   "Which organization is this work for?" → filter by orgId → Enter
 *   "Create this project as a new app on Shopify?" → Yes (default)
 *   "App name" → appName
 *   "Configuration file name" → skipped via `--config` flag
 *
 * Env overrides (via PTY spawn):
 *   CI=undefined                        — drop the key so prompts render.
 *                                         Fixture default is CI=1; Ink's `is-in-ci`
 *                                         treats `'CI' in env` as CI even when ''.
 *                                         In CI mode Ink suppresses prompt frames
 *                                         (only emitted on unmount), so waitForOutput
 *                                         hangs until the process is killed.
 *   SHOPIFY_CLI_NEVER_USE_PARTNERS_API=1 — skip Partners client in fetchOrganizations.
 *                                         Without this, fetchOrganizations iterates
 *                                         AppManagement AND Partners sequentially.
 *                                         Partners requires SHOPIFY_CLI_PARTNERS_TOKEN
 *                                         (not set in OAuth-auth'd tests) and hangs
 *                                         for minutes trying to authenticate. The e2e
 *                                         test org (161686155) lives in AppManagement.
 */
export async function configLink(
  ctx: CLIContext & {
    appName: string
    orgId: string
    configName?: string
  },
): Promise<ExecResult> {
  const args = ['app', 'config', 'link']
  // Pass configName as --config flag. link.ts → loadConfigurationFileName skips
  // the "Configuration file name" prompt when options.configName is set, which
  // also side-steps a painful interactive quirk: that prompt uses
  // `initialAnswer = remoteApp.title`, so any text we write would be appended
  // to the app name rather than replacing it.
  if (ctx.configName) args.push('--config', ctx.configName)
  args.push('--path', ctx.appDir)

  const proc = await ctx.cli.spawn(args, {
    env: {
      CI: undefined,
      SHOPIFY_CLI_NEVER_USE_PARTNERS_API: '1',
    },
  })

  // Short sleep so Ink's useInput hooks attach before we start writing.
  // Without this, an Enter press arrives mid-mount and a subsequent render can
  // flip the prompt state unexpectedly (e.g. turning a select into search mode).
  const settle = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms))

  try {
    // The first prompt is either the multi-org selector or — when the account
    // has only one org, or none of the orgs have existing apps — we jump
    // straight to `createAsNewAppPrompt`. Race all three; the loser
    // waitForOutput calls are cancelled via AbortSignal so their timers and
    // outputWaiter entries are freed immediately when the winner resolves.
    const firstPrompt = await raceWaiters((signal) => [
      proc.waitForOutput('Which organization', {timeoutMs: CLI_TIMEOUT.medium, signal}).then(() => 'org' as const),
      proc
        .waitForOutput('Create this project as a new app', {timeoutMs: CLI_TIMEOUT.medium, signal})
        .then(() => 'create' as const),
      proc.waitForOutput('App name', {timeoutMs: CLI_TIMEOUT.medium, signal}).then(() => 'appName' as const),
    ])

    if (firstPrompt === 'org') {
      // Type the orgId to filter the autocomplete prompt to exactly one match.
      // selectOrganizationPrompt's label includes `(${org.id})` when duplicate
      // org names exist (which is true for the e2e test account), so substring
      // matching on the numeric ID is unique. Avoids relying on MRU ordering.
      await settle()
      proc.ptyProcess.write(ctx.orgId)
      await settle()
      proc.sendKey('\r')
      // After org selection the CLI fetches apps for the chosen org. If
      // the org has existing apps → "Create this project" prompt. If it has
      // zero apps → selectOrCreateApp skips straight to appNamePrompt.
      const next = await raceWaiters((signal) => [
        proc
          .waitForOutput('Create this project as a new app', {timeoutMs: CLI_TIMEOUT.medium, signal})
          .then(() => 'create' as const),
        proc.waitForOutput('App name', {timeoutMs: CLI_TIMEOUT.medium, signal}).then(() => 'appName' as const),
      ])
      if (next === 'create') {
        await settle()
        proc.sendKey('\r')
      }
    } else if (firstPrompt === 'create') {
      await settle()
      proc.sendKey('\r')
    }

    // Wait for "App name" text prompt and submit the desired name.
    // Important: Ink parses each PTY data event as ONE keypress. If we write
    // "name\r" in one call, parseKeypress sees the whole string and treats
    // it as text (not Enter), so the prompt never submits. We must write the
    // text, wait for it to be consumed, then write \r separately.
    await proc.waitForOutput('App name', CLI_TIMEOUT.medium)
    await settle()
    proc.ptyProcess.write(ctx.appName)
    await settle()
    proc.sendKey('\r')

    const exitCode = await proc.waitForExit(CLI_TIMEOUT.long)
    return {exitCode, stdout: proc.getOutput(), stderr: ''}
  } finally {
    proc.kill()
  }
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
    if (!(await isVisibleWithin(nextLink, BROWSER_TIMEOUT.medium))) break
    const nextHref = await nextLink.getAttribute('href')
    if (!nextHref) break
    const nextUrl = nextHref.startsWith('http') ? nextHref : `https://dev.shopify.com${nextHref}`
    await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    await refreshIfPageError(page)
  }

  return null
}

/**
 * Delete an app from its dev dashboard settings page. Returns true if deleted.
 *
 * Single attempt — caller owns the retry loop.
 *
 * Fail-fast on STILL_HAS_INSTALLS: the Delete button stays disabled while
 * installs exist, so we throw to let the caller skip instead of spinning.
 */
export async function deleteAppFromDevDashboard(page: Page, appUrl: string): Promise<boolean> {
  // Step 1: Navigate to the app's settings page. 404 → already deleted. 5xx → throw for retry.
  await page.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)
  const gotoStatus = getLastPageStatus(page)
  if (gotoStatus === 404) return true
  if (gotoStatus !== undefined && gotoStatus >= 500) {
    throw new Error(`Server error loading app settings page (status ${gotoStatus})`)
  }

  // Step 2: Click "Delete app" to open the confirmation modal.
  // Button can be below the fold, and takes ~1-2s to enable after uninstall (one reload covers propagation lag).
  // If it stays disabled after reload, installs remain — fail fast for caller.
  const deleteBtn = page.locator('button:has-text("Delete app")').first()
  await deleteBtn.scrollIntoViewIfNeeded()
  if (!(await deleteBtn.isEnabled())) {
    await page.reload({waitUntil: 'domcontentloaded'})
    await page.waitForTimeout(BROWSER_TIMEOUT.medium)
    await deleteBtn.scrollIntoViewIfNeeded()
    if (!(await deleteBtn.isEnabled())) throw new Error('STILL_HAS_INSTALLS')
  }
  await deleteBtn.click({timeout: 2 * BROWSER_TIMEOUT.long})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Step 3: Some confirmation modals require typing "DELETE". Fill if the input is present.
  const confirmInput = page.locator('input[type="text"]').last()
  if (await isVisibleWithin(confirmInput, BROWSER_TIMEOUT.medium)) {
    await confirmInput.fill('DELETE')
    await page.waitForTimeout(BROWSER_TIMEOUT.short)
  }

  // Step 4: Click the confirm button (second "Delete app" button on the page, inside the modal).
  const confirmBtn = page.locator('button:has-text("Delete app")').last()
  await confirmBtn.click({timeout: BROWSER_TIMEOUT.long})
  await page.waitForTimeout(BROWSER_TIMEOUT.medium)

  // Step 5: Reload the settings page to confirm deletion.
  // Success → 404.
  // Failure → same settings page.
  await page.goto(`${appUrl}/settings`, {waitUntil: 'domcontentloaded'})
  await page.waitForTimeout(BROWSER_TIMEOUT.short)
  const afterStatus = getLastPageStatus(page)
  if (afterStatus === 404) return true
  if (afterStatus !== undefined && afterStatus >= 500) {
    throw new Error(`Server error verifying app deletion (status ${afterStatus})`)
  }
  return false
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

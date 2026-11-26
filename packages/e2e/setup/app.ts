/* eslint-disable no-restricted-imports */
import {dashboardFixture} from './dashboard.js'
import {CLI_TIMEOUT} from './constants.js'
import * as toml from '@iarna/toml'
import * as path from 'path'
import * as fs from 'fs'
import type {CLIContext, CLIProcess, ExecResult} from './cli.js'

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
  promises.forEach((promise) => {
    promise.catch(() => {})
  })
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
 * Read the client_id from a Shopify app TOML file.
 */
export function extractClientId(appDir: string, configName?: string): string {
  const tomlPath = path.join(appDir, configName ? `shopify.app.${configName}.toml` : 'shopify.app.toml')
  const parsed = toml.parse(fs.readFileSync(tomlPath, 'utf8'))
  const clientId = parsed.client_id as string | undefined
  if (!clientId) {
    throw new Error(`Could not find client_id in ${tomlPath}`)
  }
  return clientId
}

/**
 * Resolve the numeric app ID used by Dev Dashboard routes, which differ from client IDs.
 */
export async function devDashboardAppUrl(ctx: {
  cli: Pick<CLIProcess, 'exec'>
  appDir: string
  orgId: string
  configName?: string
}): Promise<string> {
  const args = ['app', 'info', '--json', '--path', ctx.appDir]
  if (ctx.configName) args.push('--config', ctx.configName)
  const result = await ctx.cli.exec(args, {quiet: true})
  if (result.exitCode !== 0) throw new Error(`Can't resolve the app's dashboard URL: ${result.stderr}`)
  const info = JSON.parse(result.stdout) as {remoteApp?: {id?: string}}
  const appId = info.remoteApp?.id?.match(/^(?:gid:\/\/shopify\/App\/)?(\d+)$/)?.[1]
  if (!appId) throw new Error("app info didn't return a valid numeric app ID")
  return `https://dev.shopify.com/dashboard/${ctx.orgId}/apps/${appId}`
}

/**
 * Merge an E2E TOML fixture into the app config generated by the template.
 * Template-owned fields not mentioned by the fixture are preserved.
 */
type TomlTable = Parameters<typeof toml.stringify>[0]

function isTomlTable(value: unknown): value is TomlTable {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

function mergeTomlTables(base: TomlTable, overlay: TomlTable): TomlTable {
  const merged: TomlTable = {...base}
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = merged[key]
    merged[key] =
      isTomlTable(baseValue) && isTomlTable(overlayValue) ? mergeTomlTables(baseValue, overlayValue) : overlayValue
  }
  return merged
}

export function mergeFixtureToml(generatedTomlContent: string, fixtureTomlContent: string, name: string): string {
  const generated = toml.parse(generatedTomlContent)
  const clientId = generated.client_id as string | undefined
  if (!clientId) {
    throw new Error('Could not find client_id in generated shopify.app.toml')
  }

  const fixture = toml.parse(fixtureTomlContent)

  return toml.stringify(mergeTomlTables(generated, {...fixture, client_id: clientId, name}))
}

export function injectFixtureToml(appDir: string, fixtureTomlContent: string, name: string): void {
  const tomlPath = path.join(appDir, 'shopify.app.toml')
  const patched = mergeFixtureToml(fs.readFileSync(tomlPath, 'utf8'), fixtureTomlContent, name)
  fs.writeFileSync(tomlPath, patched)
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
    allowUpdates?: boolean
    allowDeletes?: boolean
    noBuild?: boolean
  },
): Promise<ExecResult> {
  const args = ['app', 'deploy']
  if (ctx.version) args.push('--version', ctx.version)
  if (ctx.message) args.push('--message', ctx.message)
  if (ctx.config) args.push('--config', ctx.config)
  if (ctx.allowUpdates ?? true) args.push('--allow-updates')
  if (ctx.allowDeletes) args.push('--allow-deletes')
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
 *   --organization-id flag skips the organization picker
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
 */
export async function configLink(
  ctx: CLIContext & {
    appName: string
    orgId: string
    configName?: string
  },
): Promise<ExecResult> {
  const args = ['app', 'config', 'link', '--organization-id', ctx.orgId]
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
    },
  })

  // Short sleep so Ink's useInput hooks attach before we start writing.
  // Without this, an Enter press arrives mid-mount and a subsequent render can
  // flip the prompt state unexpectedly (e.g. turning a select into search mode).
  const settle = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const typeText = async (text: string) => {
    proc.ptyProcess.write(text)
    await settle(250)
  }

  try {
    // With --organization-id, the first prompt is either "Create this project"
    // when the org has existing apps, or "App name" when it does not. Race both;
    // the loser waitForOutput call is cancelled via AbortSignal so its timer and
    // outputWaiter entry are freed immediately when the winner resolves.
    const firstPrompt = await raceWaiters((signal) => [
      proc
        .waitForOutput('Create this project as a new app', {timeoutMs: CLI_TIMEOUT.medium, signal})
        .then(() => 'create' as const),
      proc.waitForOutput('App name', {timeoutMs: CLI_TIMEOUT.medium, signal}).then(() => 'appName' as const),
    ])

    if (firstPrompt === 'create') {
      await settle()
      proc.sendKey('\r')
    }

    // Wait for "App name" text prompt and submit the desired name.
    // Important: Ink parses each PTY data event as ONE keypress. Write the
    // app name as one text event so characters are not dropped during busy CI
    // renders, then write Enter separately so it is handled as submission.
    //
    // Do not wait for the full app name to appear in PTY output before pressing
    // Enter: under CI load, Ink's line-clearing renders can make the captured
    // output miss or reorder prompt echo even when the input was received.
    await proc.waitForOutput('App name', CLI_TIMEOUT.medium)
    await settle()
    await typeText(ctx.appName)
    await settle(250)
    proc.sendKey('\r')

    const exitCode = await proc.waitForExit(CLI_TIMEOUT.long)
    return {exitCode, stdout: proc.getOutput(), stderr: ''}
  } finally {
    proc.kill()
  }
}

// ---------------------------------------------------------------------------
// Fixture — ensures auth runs before tests. Tests use helper functions directly.
// ---------------------------------------------------------------------------

export const appTestFixture = dashboardFixture.extend<{authReady: void}>({
  // Auto-trigger authLogin so the OAuth session is available for all app tests
  authReady: [
    async ({authLogin: _authLogin}: {authLogin: void}, use: () => Promise<void>) => {
      await use()
    },
    {auto: true},
  ],
})

/* eslint-disable no-restricted-imports */
import {authFixture} from './auth.js'
import * as path from 'path'
import * as fs from 'fs'
import type {CLIProcess, ExecResult} from './cli.js'

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
  allExtensions: {
    configuration: {name: string; type: string; handle?: string}
    directory: string
    outputPath: string
    entrySourceFilePath: string
  }[]
}

/** Shared scaffold builder. defaultName is used when opts.name is omitted. */
function buildScaffold(
  cli: CLIProcess,
  appTmpDir: string,
  defaultName: string,
  orgId?: string,
): {scaffold: AppScaffold} {
  let appDir = ''

  const scaffold: AppScaffold = {
    get appDir() {
      if (!appDir) throw new Error('App has not been initialized yet. Call init() first.')
      return appDir
    },

    async init(opts: AppInitOptions) {
      const name = opts.name ?? defaultName
      const template = opts.template ?? 'reactRouter'
      const packageManager = opts.packageManager ?? 'npm'

      const args = [
        '--name',
        name,
        '--path',
        appTmpDir,
        '--package-manager',
        packageManager,
        '--local',
        '--template',
        template,
      ]
      if (orgId) args.push('--organization-id', orgId)
      if (opts.flavor) args.push('--flavor', opts.flavor)

      const result = await cli.execCreateApp(args, {
        env: {FORCE_COLOR: '0'},
        timeout: 5 * 60 * 1000,
      })

      if (result.exitCode !== 0) {
        return result
      }

      const allOutput = `${result.stdout}\n${result.stderr}`
      const match = allOutput.match(/([\w-]+) is ready for you to build!/)

      if (match?.[1]) {
        appDir = path.join(appTmpDir, match[1])
      } else {
        const entries = fs.readdirSync(appTmpDir, {withFileTypes: true})
        const appEntry = entries.find(
          (entry) => entry.isDirectory() && fs.existsSync(path.join(appTmpDir, entry.name, 'shopify.app.toml')),
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
      const args = ['app', 'generate', 'extension', '--name', opts.name, '--path', appDir, '--template', opts.template]
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

  return {scaffold}
}

/** Fixture: scaffolds a local app linked to a pre-existing remote app (via SHOPIFY_FLAG_CLIENT_ID). */
export const appScaffoldFixture = authFixture.extend<{appScaffold: AppScaffold}>({
  appScaffold: async ({cli, env, authLogin: _authLogin}, use) => {
    const appTmpDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const {scaffold} = buildScaffold(cli, appTmpDir, 'e2e-test-app')
    await use(scaffold)
    fs.rmSync(appTmpDir, {recursive: true, force: true})
  },
})

/** CLI wrapper that strips SHOPIFY_FLAG_CLIENT_ID so commands use the toml's client_id. */
function makeFreshCli(baseCli: CLIProcess, baseProcessEnv: NodeJS.ProcessEnv): CLIProcess {
  const freshEnv = {...baseProcessEnv, SHOPIFY_FLAG_CLIENT_ID: undefined}
  return {
    exec: (args, opts = {}) => baseCli.exec(args, {...opts, env: {...freshEnv, ...opts.env}}),
    execCreateApp: (args, opts = {}) => baseCli.execCreateApp(args, {...opts, env: {...freshEnv, ...opts.env}}),
    spawn: (args, opts = {}) => baseCli.spawn(args, {...opts, env: {...freshEnv, ...opts.env}}),
  }
}

/** Fixture: creates a brand-new app on every run. Requires E2E_ORG_ID. */
export const freshAppScaffoldFixture = authFixture.extend<{appScaffold: AppScaffold; cli: CLIProcess}>({
  cli: async ({cli: baseCli, env}, use) => {
    await use(makeFreshCli(baseCli, env.processEnv))
  },

  appScaffold: async ({cli, env, authLogin: _authLogin}, use) => {
    const appTmpDir = fs.mkdtempSync(path.join(env.tempDir, 'fresh-app-'))
    const {scaffold} = buildScaffold(cli, appTmpDir, `QA-E2E-1st-${Date.now()}`, env.orgId || undefined)
    await use(scaffold)
    fs.rmSync(appTmpDir, {recursive: true, force: true})
  },
})

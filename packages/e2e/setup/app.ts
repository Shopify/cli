/* eslint-disable no-restricted-imports */
import {authFixture} from './auth.js'
import * as path from 'path'
import * as fs from 'fs'
import type {ExecResult} from './cli.js'

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

/**
 * Test-scoped fixture that creates a fresh app in a temp directory.
 * Depends on authLogin (worker-scoped) for OAuth session.
 */
export const appScaffoldFixture = authFixture.extend<{appScaffold: AppScaffold}>({
  appScaffold: async ({cli, env, authLogin: _authLogin}, use) => {
    const appTmpDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    let appDir = ''

    const scaffold: AppScaffold = {
      get appDir() {
        if (!appDir) throw new Error('App has not been initialized yet. Call init() first.')
        return appDir
      },

      async init(opts: AppInitOptions) {
        const name = opts.name ?? 'e2e-test-app'
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
        if (opts.flavor) args.push('--flavor', opts.flavor)

        const result = await cli.execCreateApp(args, {
          env: {FORCE_COLOR: '0'},
          timeout: 5 * 60 * 1000,
        })

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
        const args = [
          'app',
          'generate',
          'extension',
          '--name',
          opts.name,
          '--path',
          appDir,
          '--template',
          opts.template,
        ]
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

    await use(scaffold)
    fs.rmSync(appTmpDir, {recursive: true, force: true})
  },
})

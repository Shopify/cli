import {coerceSemverVersion} from './semver.js'
import * as file from '../../file.js'
import * as ui from '../../ui.js'
import * as system from '../../system.js'
import {Abort, AbortSilent} from '../../error.js'
import {glob, join} from '../../path.js'
import constants from '../../constants.js'
import {AdminSession} from '../../session.js'
import {content, token} from '../../output.js'
import {AbortSignal} from 'abort-controller'
import {Writable} from 'node:stream'

const RubyCLIVersion = '2.31.0'
const ThemeCheckVersion = '1.10.3'
const MinBundlerVersion = '2.3.8'
const MinRubyVersion = '2.7.5'

interface ExecCLI2Options {
  // Contains token and store to pass to CLI 2.0, which will be set as environment variables
  adminSession?: AdminSession
  // Contains token for storefront access to pass to CLI 2.0 as environment variable
  storefrontToken?: string
  // Contains token for partners access to pass to CLI 2.0 as environment variable
  token?: string
  // Directory in which to execute the command. Otherwise the current directory will be used.
  directory?: string

  signal?: AbortSignal
}
/**
 * Execute CLI 2.0 commands.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args - List of argumets to execute. (ex: ['theme', 'pull'])
 * @param options - Options to customize the execution of cli2.
 */
export async function execCLI2(
  args: string[],
  {adminSession, storefrontToken, token, directory, signal}: ExecCLI2Options = {},
) {
  await installCLIDependencies()
  const env = {
    ...process.env,
    SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: storefrontToken,
    SHOPIFY_CLI_ADMIN_AUTH_TOKEN: adminSession?.token,
    SHOPIFY_SHOP: adminSession?.storeFqdn,
    SHOPIFY_CLI_AUTH_TOKEN: token,
    SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
    // Bundler uses this Gemfile to understand which gems are available in the
    // environment. We use this to specify our own Gemfile for CLI2, which exists
    // outside the user's project directory.
    BUNDLE_GEMFILE: join(shopifyCLIDirectory(), 'Gemfile'),
  }

  try {
    await system.exec(bundleExecutable(), ['exec', 'shopify'].concat(args), {
      stdio: 'inherit',
      cwd: directory ?? process.cwd(),
      env,
      signal,
    })
  } catch (error) {
    // CLI2 will show it's own errors, we don't need to show an additional CLI3 error
    throw new AbortSilent()
  }
}

interface ExecThemeCheckCLIOptions {
  /** A list of directories in which theme-check should run */
  directories: string[]
  /** Arguments to pass to the theme-check CLI */
  args?: string[]
  /** Writable to send standard output content through */
  stdout: Writable
  /** Writable to send standard error content through */
  stderr: Writable
}

/**
 * A function that installs (if needed) and runs the theme-check CLI.
 * @param options - Options to customize the execution of theme-check.
 * @returns A promise that resolves or rejects depending on the result of the underlying theme-check process.
 */
export async function execThemeCheckCLI({
  directories,
  args,
  stdout,
  stderr,
}: ExecThemeCheckCLIOptions): Promise<void[]> {
  await installThemeCheckCLIDependencies(stdout)

  const processes = directories.map(async (directory): Promise<void> => {
    // Check that there are files aside from the extension TOML config file,
    // otherwise theme-check will return a false failure.
    const files = await glob(join(directory, '/**/*'))
    const fileCount = files.filter((file) => !file.match(/\.toml$/)).length
    if (fileCount === 0) return

    const customStderr = new Writable({
      write(chunk, ...args) {
        // For some reason, theme-check reports this initial status line to stderr
        // See https://github.com/Shopify/theme-check/blob/1092737cfb58a73ca397ffb1371665dc55df2976/lib/theme_check/language_server/diagnostics_engine.rb#L31
        // which leads to https://github.com/Shopify/theme-check/blob/1092737cfb58a73ca397ffb1371665dc55df2976/lib/theme_check/language_server/io_messenger.rb#L65
        if (chunk.toString('ascii').match(/^Checking/)) {
          stdout.write(chunk, ...args)
        } else {
          stderr.write(chunk, ...args)
        }
      },
    })
    await system.exec(bundleExecutable(), ['exec', 'theme-check'].concat([directory, ...(args || [])]), {
      stdout,
      stderr: customStderr,
      cwd: themeCheckDirectory(),
    })
  })
  return Promise.all(processes)
}

/**
 * Validate Ruby Enviroment
 * Install Theme Check CLI and its dependencies
 * Shows a loading message if it's the first time installing dependencies
 * or if we are installing a new version of Theme Check CLI
 */
async function installThemeCheckCLIDependencies(stdout: Writable) {
  const exists = await file.exists(themeCheckDirectory())

  if (!exists) stdout.write('Installing theme dependencies...')
  const list = ui.newListr(
    [
      {
        title: 'Installing theme dependencies',
        task: async () => {
          await validateRubyEnv()
          await createThemeCheckCLIWorkingDirectory()
          await createThemeCheckGemfile()
          await bundleInstallThemeCheck()
        },
      },
    ],
    {renderer: 'silent'},
  )
  await list.run()
  if (!exists) stdout.write('Installed theme dependencies!')
}

/**
 * Validate Ruby Enviroment
 * Install RubyCLI and its dependencies
 * Shows a loading spinner if it's the first time installing dependencies
 * or if we are installing a new version of RubyCLI
 */
async function installCLIDependencies() {
  const exists = await file.exists(shopifyCLIDirectory())
  const renderer = exists ? 'silent' : 'default'

  const list = ui.newListr(
    [
      {
        title: 'Installing theme dependencies',
        task: async () => {
          const usingLocalCLI2 = Boolean(process.env.SHOPIFY_CLI_2_0_DIRECTORY)
          await validateRubyEnv()
          if (usingLocalCLI2) {
            await bundleInstallLocalShopifyCLI()
          } else {
            await createShopifyCLIWorkingDirectory()
            await createShopifyCLIGemfile()
            await bundleInstallShopifyCLI()
          }
        },
      },
    ],
    {renderer},
  )
  await list.run()
}

async function validateRubyEnv() {
  await validateRuby()
  await validateBundler()
}

async function validateRuby() {
  let version
  try {
    const stdout = await system.captureOutput(rubyExecutable(), ['-v'])
    version = coerceSemverVersion(stdout)
  } catch {
    throw new Abort(
      'Ruby environment not found',
      `Make sure you have Ruby installed on your system. ${
        content`${token.link('Documentation.', 'https://www.ruby-lang.org/en/documentation/installation/')}`.value
      }`,
    )
  }

  const isValid = version?.compare(MinRubyVersion)
  if (isValid === -1 || isValid === undefined) {
    throw new Abort(
      `Ruby version ${content`${token.yellow(version.raw)}`.value} is not supported`,
      `Make sure you have at least Ruby ${content`${token.yellow(MinRubyVersion)}`.value} installed on your system. ${
        content`${token.link('Documentation.', 'https://www.ruby-lang.org/en/documentation/installation/')}`.value
      }`,
    )
  }
}

async function validateBundler() {
  let version
  try {
    const stdout = await system.captureOutput(bundleExecutable(), ['-v'])
    version = coerceSemverVersion(stdout)
  } catch {
    throw new Abort(
      'Bundler not found',
      `To install the latest version of Bundler, run ${
        content`${token.genericShellCommand(`${gemExecutable()} install bundler`)}`.value
      }`,
    )
  }

  const isValid = version?.compare(MinBundlerVersion)
  if (isValid === -1 || isValid === undefined) {
    throw new Abort(
      `Bundler version ${content`${token.yellow(version.raw)}`.value} is not supported`,
      `To update to the latest version of Bundler, run ${
        content`${token.genericShellCommand(`${gemExecutable()} install bundler`)}`.value
      }`,
    )
  }
}

function createShopifyCLIWorkingDirectory() {
  return file.mkdir(shopifyCLIDirectory())
}

function createThemeCheckCLIWorkingDirectory() {
  return file.mkdir(themeCheckDirectory())
}

async function createShopifyCLIGemfile() {
  const gemPath = join(shopifyCLIDirectory(), 'Gemfile')
  await file.write(gemPath, `source 'https://rubygems.org'\ngem 'shopify-cli', '${RubyCLIVersion}'`)
}

async function createThemeCheckGemfile() {
  const gemPath = join(themeCheckDirectory(), 'Gemfile')
  await file.write(gemPath, `source 'https://rubygems.org'\ngem 'theme-check', '${ThemeCheckVersion}'`)
}

async function bundleInstallLocalShopifyCLI() {
  await system.exec(bundleExecutable(), ['install'], {cwd: shopifyCLIDirectory()})
}

async function bundleInstallShopifyCLI() {
  await system.exec(bundleExecutable(), ['config', 'set', '--local', 'path', shopifyCLIDirectory()], {
    cwd: shopifyCLIDirectory(),
  })
  await system.exec(bundleExecutable(), ['install'], {cwd: shopifyCLIDirectory()})
}

async function bundleInstallThemeCheck() {
  await system.exec(bundleExecutable(), ['config', 'set', '--local', 'path', themeCheckDirectory()], {
    cwd: themeCheckDirectory(),
  })
  await system.exec(bundleExecutable(), ['install'], {cwd: themeCheckDirectory()})
}

function shopifyCLIDirectory() {
  return (
    process.env.SHOPIFY_CLI_2_0_DIRECTORY ??
    join(constants.paths.directories.cache.vendor.path(), 'ruby-cli', RubyCLIVersion)
  )
}

function themeCheckDirectory() {
  return join(constants.paths.directories.cache.vendor.path(), 'theme-check', ThemeCheckVersion)
}

export async function version(): Promise<string | undefined> {
  const parseOutput = (version: string) => version.match(/ruby (\d+\.\d+\.\d+)/)?.[1]
  return system
    .captureOutput(rubyExecutable(), ['-v'])
    .then(parseOutput)
    .catch(() => undefined)
}

function getRubyBinDir(): string | undefined {
  return process.env.SHOPIFY_RUBY_BINDIR
}

function rubyExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? join(rubyBinDir, 'ruby') : 'ruby'
}

function bundleExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? join(rubyBinDir, 'bundle') : 'bundle'
}

function gemExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? join(rubyBinDir, 'gem') : 'gem'
}

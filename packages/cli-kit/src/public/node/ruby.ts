import {coerceSemverVersion} from './semver.js'
import {renderTasks} from './ui.js'
import {AbortSignal} from './abort.js'
import {platformAndArch} from './os.js'
import {captureOutput, exec} from './system.js'
import * as file from './fs.js'
import {joinPath, cwd} from './path.js'
import {AbortError, AbortSilentError} from './error.js'
import {pathConstants} from '../../private/node/constants.js'
import {AdminSession} from '../../public/node/session.js'
import {outputContent, outputToken} from '../../public/node/output.js'
import {Writable} from 'stream'

const RubyCLIVersion = '2.34.0'
const ThemeCheckVersion = '1.14.0'
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
  // A signal to stop the process execution.
  signal?: AbortSignal
}
/**
 * Execute CLI 2.0 commands.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args - List of argumets to execute. (ex: ['theme', 'pull']).
 * @param options - Options to customize the execution of cli2.
 */
export async function execCLI2(args: string[], options: ExecCLI2Options = {}): Promise<void> {
  await installCLIDependencies()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: options.storefrontToken,
    SHOPIFY_CLI_ADMIN_AUTH_TOKEN: options.adminSession?.token,
    SHOPIFY_SHOP: options.adminSession?.storeFqdn,
    SHOPIFY_CLI_AUTH_TOKEN: options.token,
    SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
    // Bundler uses this Gemfile to understand which gems are available in the
    // environment. We use this to specify our own Gemfile for CLI2, which exists
    // outside the user's project directory.
    BUNDLE_GEMFILE: joinPath(shopifyCLIDirectory(), 'Gemfile'),
  }

  try {
    await exec(bundleExecutable(), ['exec', 'shopify'].concat(args), {
      stdio: 'inherit',
      cwd: options.directory ?? cwd(),
      env,
      signal: options.signal,
    })
  } catch (error) {
    // CLI2 will show it's own errors, we don't need to show an additional CLI3 error
    throw new AbortSilentError()
  }
}

interface ExecThemeCheckCLIOptions {
  /** A list of directories in which theme-check should run. */
  directories: string[]
  /** Arguments to pass to the theme-check CLI. */
  args?: string[]
  /** Writable to send standard output content through. */
  stdout: Writable
  /** Writable to send standard error content through. */
  stderr: Writable
}

/**
 * A function that installs (if needed) and runs the theme-check CLI.
 *
 * @param options - Options to customize the execution of theme-check.
 * @returns A promise that resolves or rejects depending on the result of the underlying theme-check process.
 */
export async function execThemeCheckCLI(options: ExecThemeCheckCLIOptions): Promise<void[]> {
  await installThemeCheckCLIDependencies(options.stdout)

  const processes = options.directories.map(async (directory): Promise<void> => {
    // Check that there are files aside from the extension TOML config file,
    // otherwise theme-check will return a false failure.
    const files = await file.glob(joinPath(directory, '/**/*'))
    const fileCount = files.filter((file) => !file.match(/\.toml$/)).length
    if (fileCount === 0) return

    const customStderr = new Writable({
      write(chunk, ...args) {
        // For some reason, theme-check reports this initial status line to stderr
        // See https://github.com/Shopify/theme-check/blob/1092737cfb58a73ca397ffb1371665dc55df2976/lib/theme_check/language_server/diagnostics_engine.rb#L31
        // which leads to https://github.com/Shopify/theme-check/blob/1092737cfb58a73ca397ffb1371665dc55df2976/lib/theme_check/language_server/io_messenger.rb#L65
        if (chunk.toString('ascii').match(/^Checking/)) {
          options.stdout.write(chunk, ...args)
        } else {
          options.stderr.write(chunk, ...args)
        }
      },
    })
    await exec(bundleExecutable(), ['exec', 'theme-check'].concat([directory, ...(options.args || [])]), {
      stdout: options.stdout,
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
 * or if we are installing a new version of Theme Check CLI.
 *
 * @param stdout - The Writable stream on which to write the standard output.
 */
async function installThemeCheckCLIDependencies(stdout: Writable) {
  const exists = await file.fileExists(themeCheckDirectory())

  if (!exists) stdout.write('Installing theme dependencies...')
  await validateRubyEnv()
  await createThemeCheckCLIWorkingDirectory()
  await createThemeCheckGemfile()
  await bundleInstallThemeCheck()
  if (!exists) stdout.write('Installed theme dependencies!')
}

/**
 * Validate Ruby Enviroment
 * Install RubyCLI and its dependencies
 * Shows a loading spinner if it's the first time installing dependencies
 * or if we are installing a new version of RubyCLI.
 */
async function installCLIDependencies() {
  const exists = await file.fileExists(shopifyCLIDirectory())
  const tasks = [
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
  ]

  if (exists) {
    await tasks[0]!.task()
  } else {
    await renderTasks(tasks)
  }
}

/**
 * A function that validates if the environment in which the CLI is running is set up with Ruby and Bundler.
 */
async function validateRubyEnv() {
  await validateRuby()
  await validateBundler()
}

/**
 * A function that validates if the environment in which the CLI is running is set up with Ruby.
 */
async function validateRuby() {
  let version
  try {
    const stdout = await captureOutput(rubyExecutable(), ['-v'])
    version = coerceSemverVersion(stdout)
  } catch {
    throw new AbortError(
      'Ruby environment not found',
      `Make sure you have Ruby installed on your system. ${
        outputContent`${outputToken.link('Documentation.', 'https://www.ruby-lang.org/en/documentation/installation/')}`
          .value
      }`,
    )
  }

  const isValid = version?.compare(MinRubyVersion)
  if (isValid === -1 || isValid === undefined) {
    throw new AbortError(
      `Ruby version ${outputContent`${outputToken.yellow(version.raw)}`.value} is not supported`,
      `Make sure you have at least Ruby ${
        outputContent`${outputToken.yellow(MinRubyVersion)}`.value
      } installed on your system. ${
        outputContent`${outputToken.link('Documentation.', 'https://www.ruby-lang.org/en/documentation/installation/')}`
          .value
      }`,
    )
  }
}

/**
 * A function that validates if the environment in which the CLI is running is set up with Bundler.
 */
async function validateBundler() {
  let version
  try {
    const stdout = await captureOutput(bundleExecutable(), ['-v'])
    version = coerceSemverVersion(stdout)
  } catch {
    throw new AbortError(
      'Bundler not found',
      `To install the latest version of Bundler, run ${
        outputContent`${outputToken.genericShellCommand(`${gemExecutable()} install bundler`)}`.value
      }`,
    )
  }

  const isValid = version?.compare(MinBundlerVersion)
  if (isValid === -1 || isValid === undefined) {
    throw new AbortError(
      `Bundler version ${outputContent`${outputToken.yellow(version.raw)}`.value} is not supported`,
      `To update to the latest version of Bundler, run ${
        outputContent`${outputToken.genericShellCommand(`${gemExecutable()} install bundler`)}`.value
      }`,
    )
  }
}

/**
 * It creates the directory where the Ruby CLI will be downloaded along its dependencies.
 */
async function createShopifyCLIWorkingDirectory(): Promise<void> {
  return file.mkdir(shopifyCLIDirectory())
}

/**
 * It creates the directory where the theme-check CLI will be downloaded along its dependencies.
 */
async function createThemeCheckCLIWorkingDirectory(): Promise<void> {
  return file.mkdir(themeCheckDirectory())
}

/**
 * It creates the Gemfile to install The Ruby CLI and the dependencies.
 */
async function createShopifyCLIGemfile(): Promise<void> {
  const gemPath = joinPath(shopifyCLIDirectory(), 'Gemfile')
  const gemFileContent = ["source 'https://rubygems.org'", `gem 'shopify-cli', '${RubyCLIVersion}'`]
  const {platform} = platformAndArch()
  if (platform === 'windows') {
    // 'wdm' is required by 'listen', see https://github.com/Shopify/cli/issues/780
    gemFileContent.push("gem 'wdm', '>= 0.1.0'")
  }
  await file.writeFile(gemPath, gemFileContent.join('\n'))
}

/**
 * It creates the Gemfile to install theme-check and its dependencies.
 */
async function createThemeCheckGemfile(): Promise<void> {
  const gemPath = joinPath(themeCheckDirectory(), 'Gemfile')
  await file.writeFile(gemPath, `source 'https://rubygems.org'\ngem 'theme-check', '${ThemeCheckVersion}'`)
}

/**
 * It runs bundle install for the dev-managed copy of the Ruby CLI.
 */
async function bundleInstallLocalShopifyCLI(): Promise<void> {
  await exec(bundleExecutable(), ['install'], {cwd: shopifyCLIDirectory()})
}

/**
 * It runs bundle install for the CLI-managed copy of the Ruby CLI.
 */
async function bundleInstallShopifyCLI() {
  await exec(bundleExecutable(), ['config', 'set', '--local', 'path', shopifyCLIDirectory()], {
    cwd: shopifyCLIDirectory(),
  })
  await exec(bundleExecutable(), ['install'], {cwd: shopifyCLIDirectory()})
}

/**
 * It runs bundle install for the CLI-managed copy of theme-check.
 */
async function bundleInstallThemeCheck() {
  await exec(bundleExecutable(), ['config', 'set', '--local', 'path', themeCheckDirectory()], {
    cwd: themeCheckDirectory(),
  })
  await exec(bundleExecutable(), ['install'], {cwd: themeCheckDirectory()})
}

/**
 * It returns the directory where the Ruby CLI is located.
 *
 * @returns The absolute path to the directory.
 */
function shopifyCLIDirectory(): string {
  return (
    process.env.SHOPIFY_CLI_2_0_DIRECTORY ??
    joinPath(pathConstants.directories.cache.vendor.path(), 'ruby-cli', RubyCLIVersion)
  )
}

/**
 * It returns the path to the directory containing the theme-check CLI.
 *
 * @returns The absolute path to the theme-check directory.
 */
function themeCheckDirectory(): string {
  return joinPath(pathConstants.directories.cache.vendor.path(), 'theme-check', ThemeCheckVersion)
}

/**
 * It returns the Ruby version present in the envirronment.
 */
export async function version(): Promise<string | undefined> {
  const parseOutput = (version: string) => version.match(/ruby (\d+\.\d+\.\d+)/)?.[1]
  return captureOutput(rubyExecutable(), ['-v'])
    .then(parseOutput)
    .catch(() => undefined)
}

/**
 * It returns the Ruby binary path set through the environment variable SHOPIFY_RUBY_BINDIR.
 * This is useful when the CLI is managed by an installer like a Homebrew where we need to
 * point the CLI to the Ruby installation managed by Homebrew.
 *
 * @returns The value of the environment variable.
 */
function getRubyBinDir(): string | undefined {
  return process.env.SHOPIFY_RUBY_BINDIR
}

/**
 * It returns the path to the "ruby" executable.
 *
 * @returns The path to the executable.
 */
function rubyExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? joinPath(rubyBinDir, 'ruby') : 'ruby'
}

/**
 * It returns the path to the "bundle" executable.
 *
 * @returns The path to the executable.
 */
function bundleExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? joinPath(rubyBinDir, 'bundle') : 'bundle'
}

/**
 * It returns the path to the "gem"" executable.
 *
 * @returns The path to the executable.
 */
function gemExecutable(): string {
  const rubyBinDir = getRubyBinDir()
  return rubyBinDir ? joinPath(rubyBinDir, 'gem') : 'gem'
}

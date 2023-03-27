import {AbortSignal} from './abort.js'
import {platformAndArch} from './os.js'
import {captureOutput, exec} from './system.js'
import * as file from './fs.js'
import {joinPath, dirname, cwd} from './path.js'
import {AbortError, AbortSilentError} from './error.js'
import {getEnvironmentVariables} from './environment.js'
import {isSpinEnvironment, spinFqdn} from './context/spin.js'
import {pathConstants} from '../../private/node/constants.js'
import {AdminSession} from '../../public/node/session.js'
import {outputContent, outputToken} from '../../public/node/output.js'
import {isTruthy} from '../../private/node/context/utilities.js'
import {coerceSemverVersion} from '../../private/node/semver.js'
import envPaths from 'env-paths'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

export const RubyCLIVersion = '2.35.0'
const ThemeCheckVersion = '1.14.0'
const MinBundlerVersion = '2.3.11'
const MinRubyVersion = '2.7.5'
export const MinWdmWindowsVersion = '0.1.0'
const shopifyGems = envPaths('shopify-gems')

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
  // Stream to pipe the command's stdout to.
  stdout?: Writable
  // Stream to pipe the command's stdout to.
  stderr?: Writable
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
  const currentEnv = getEnvironmentVariables()
  const embedded = !isTruthy(currentEnv.SHOPIFY_CLI_BUNDLED_THEME_CLI) && !currentEnv.SHOPIFY_CLI_2_0_DIRECTORY

  await installCLIDependencies(options.stdout ?? process.stdout, embedded)
  const env: NodeJS.ProcessEnv = {
    ...currentEnv,
    SHOPIFY_CLI_STOREFRONT_RENDERER_AUTH_TOKEN: options.storefrontToken,
    SHOPIFY_CLI_ADMIN_AUTH_TOKEN: options.adminSession?.token,
    SHOPIFY_SHOP: options.adminSession?.storeFqdn,
    SHOPIFY_CLI_AUTH_TOKEN: options.token,
    SHOPIFY_CLI_RUN_AS_SUBPROCESS: 'true',
    SHOPIFY_CLI_RUBY_BIN: rubyExecutable(),
    // Bundler uses this Gemfile to understand which gems are available in the
    // environment. We use this to specify our own Gemfile for CLI2, which exists
    // outside the user's project directory.
    BUNDLE_GEMFILE: joinPath(await shopifyCLIDirectory(embedded), 'Gemfile'),
    ...(await getSpinEnvironmentVariables()),
  }

  try {
    const shopifyExecutable = embedded ? [rubyExecutable(), await embeddedCLIExecutable()] : ['shopify']
    await exec(bundleExecutable(), ['exec', ...shopifyExecutable, ...args], {
      ...(options.stdout === undefined && {stdio: 'inherit'}),
      cwd: options.directory ?? cwd(),
      env,
      ...(options.stdout !== undefined && {stdout: options.stdout, stderr: options.stderr}),
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
 *
 * @param stdout - The Writable stream on which to write the standard output.
 * @param embedded - True when embebbed codebase of CLI should be used.
 */
async function installCLIDependencies(stdout: Writable, embedded = false) {
  const localCLI = await shopifyCLIDirectory(embedded)
  const exists = await file.fileExists(localCLI)

  if (!exists) stdout.write('Installing theme dependencies...')
  const usingLocalCLI2 = embedded || isTruthy(getEnvironmentVariables().SHOPIFY_CLI_2_0_DIRECTORY)
  await validateRubyEnv()
  if (usingLocalCLI2) {
    await bundleInstallLocalShopifyCLI(localCLI)
  } else {
    await createShopifyCLIWorkingDirectory()
    await createShopifyCLIGemfile()
    await bundleInstallShopifyCLI()
  }

  if (!exists) stdout.write('Installed theme dependencies!')
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
  return file.mkdir(await shopifyCLIDirectory())
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
  const directory = await shopifyCLIDirectory()
  const gemfileContent = getBaseGemfileContent().concat(getWindowsDependencies())
  await addContentToGemfile(directory, gemfileContent)
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
 *
 * @param directory - Directory where CLI2 Gemfile is located.
 */
async function bundleInstallLocalShopifyCLI(directory: string): Promise<void> {
  await addContentToGemfile(directory, getWindowsDependencies())
  await shopifyBundleInstall(directory)
}

/**
 * Build the list of lines with the base content of the Gemfile.
 *
 * @returns List of lines with base content.
 */
function getBaseGemfileContent() {
  return ["source 'https://rubygems.org'", `gem 'shopify-cli', '${RubyCLIVersion}'`]
}

/**
 * Build the list of Windows dependencies.
 *
 * @returns List of Windows dependencies.
 */
function getWindowsDependencies() {
  if (platformAndArch().platform === 'windows') {
    // 'wdm' is required by 'listen', see https://github.com/Shopify/cli/issues/780
    // Because it's a Windows-only dependency, it's not included in the `.gemspec` or `Gemfile`.
    // Otherwise it would be installed in non-Windows environments too, where it is not needed.
    return [`gem 'wdm', '>= ${MinWdmWindowsVersion}'`]
  }
  return []
}

/**
 * Append contente to a Gemfile located in the given directory.
 *
 * @param gemfileDirectory - Directory where Gemfile is located.
 * @param content - Content to append to the Gemfile.
 */
async function addContentToGemfile(gemfileDirectory: string, content: string[]) {
  const gemfilePath = joinPath(gemfileDirectory, 'Gemfile')
  if (!(await file.fileExists(gemfilePath))) await file.touchFile(gemfilePath)
  const gemContent = await file.readFile(gemfilePath, {encoding: 'utf8'})
  const contentNoExisting = content.filter((line) => !gemContent.includes(line)).join('\n')
  if (contentNoExisting) await file.appendFile(gemfilePath, contentNoExisting.concat('\n'))
}

/**
 * It runs bundle install for the CLI-managed copy of the Ruby CLI.
 */
async function bundleInstallShopifyCLI() {
  await shopifyBundleInstall(await shopifyCLIDirectory())
}

/**
 * It runs bundle install for the CLI-managed copy of theme-check.
 */
async function bundleInstallThemeCheck() {
  await shopifyBundleInstall(themeCheckDirectory())
}

/**
 * It returns the directory where the Ruby CLI is located.
 *
 * @param embedded - True when embebbed codebase of CLI should be used.
 * @returns The absolute path to the directory.
 */
async function shopifyCLIDirectory(embedded = false): Promise<string> {
  const embeddedDirectory = (await file.findPathUp('assets/cli-ruby', {
    type: 'directory',
    cwd: dirname(fileURLToPath(import.meta.url)),
  })) as string
  const bundledDirectory = joinPath(pathConstants.directories.cache.vendor.path(), 'ruby-cli', RubyCLIVersion)

  return embedded ? embeddedDirectory : getEnvironmentVariables().SHOPIFY_CLI_2_0_DIRECTORY ?? bundledDirectory
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
  return getEnvironmentVariables().SHOPIFY_RUBY_BINDIR
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

/**
 * It returns the path to the "bundle" executable.
 *
 * @returns The path to the executable.
 */
async function embeddedCLIExecutable(): Promise<string> {
  const cliDirectory = await shopifyCLIDirectory(true)
  return joinPath(cliDirectory, 'bin', 'shopify')
}

/**
 * Get environment variables required by the CLI2 in case the CLI3 is running in a Spin environment.
 *
 * @returns The environment variables to set.
 */
async function getSpinEnvironmentVariables() {
  if (!isSpinEnvironment()) return {}

  return {
    SPIN_FQDN: await spinFqdn(),
    SPIN: '1',
  }
}

/**
 * It sets bundler's path to a directory dedicated to shopify gems and runs bundle install.
 * This is desirable because these gems will be isolated from the system gems.
 *
 * @param directory - Directory where the Gemfile is located.
 */
async function shopifyBundleInstall(directory: string): Promise<void> {
  const bundle = bundleExecutable()
  const shopifyGemsPath = shopifyGems.cache

  await exec(bundle, ['config', 'set', '--local', 'path', shopifyGemsPath], {
    cwd: directory,
  })

  await exec(bundle, ['config', 'set', '--local', 'without', 'development:test'], {
    cwd: directory,
  })
  await exec(bundle, ['install'], {cwd: directory})
}

import * as file from './file'
import * as ui from './ui'
import * as system from './system'
import {Abort} from './error'
import {glob, join} from './path'
import constants from './constants'
import {coerce} from './semver'
import {AdminSession} from './session'
// eslint-disable-next-line no-restricted-imports
import {spawn} from 'child_process'
import {Writable} from 'node:stream'

const RubyCLIVersion = '2.16.0'
const ThemeCheckVersion = '1.10.2'
const MinBundlerVersion = '2.3.8'

/**
 * Execute CLI 2.0 commands.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args {string[]} List of argumets to execute. (ex: ['theme', 'pull'])
 * @param adminSession {AdminSession} Contains token and store to pass to CLI 2.0, which will be set as environment variables
 */
export async function execCLI(args: string[], adminSession?: AdminSession) {
  await installCLIDependencies()
  const env = {
    ...process.env,
    SHOPIFY_CLI_ADMIN_AUTH_TOKEN: adminSession?.token,
    SHOPIFY_CLI_STORE: adminSession?.storeFqdn,
  }

  spawn('bundle', ['exec', 'shopify'].concat(args), {
    stdio: 'inherit',
    shell: true,
    cwd: shopifyCLIDirectory(),
    env,
  })
}

interface ExecThemeCheckCLIOptions {
  directories: string[]
  args?: string[]
  stdout: Writable
  stderr: Writable
}
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
    await system.exec('bundle', ['exec', 'theme-check'].concat([directory, ...(args || [])]), {
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
  const list = new ui.Listr(
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

  const list = new ui.Listr(
    [
      {
        title: 'Installing theme dependencies',
        task: async () => {
          await validateRubyEnv()
          await createShopifyCLIWorkingDirectory()
          await createShopifyCLIGemfile()
          await bundleInstallShopifyCLI()
        },
      },
    ],
    {renderer},
  )
  await list.run()
}

async function validateRubyEnv() {
  try {
    await system.exec('ruby', ['-v'])
  } catch {
    throw new Abort(
      'Ruby environment not found',
      'Make sure you have ruby installed on your system: https://www.ruby-lang.org/en/documentation/installation/',
    )
  }

  const bundlerVersion = await getBundlerVersion()
  const isValid = bundlerVersion?.compare(MinBundlerVersion)
  if (isValid === -1 || isValid === undefined) {
    throw new Abort(
      `Bundler version ${bundlerVersion} is not supported`,
      `Make sure you have Bundler version ${MinBundlerVersion} or higher installed on your system: https://bundler.io/`,
    )
  }
}

async function getBundlerVersion() {
  try {
    const {stdout} = await system.exec('bundler', ['-v'])
    return coerce(stdout)
  } catch {
    throw new Abort('Bundler not found', 'Make sure you have Bundler installed on your system: https://bundler.io/')
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

async function bundleInstallShopifyCLI() {
  await system.exec('bundle', ['config', 'set', '--local', 'path', shopifyCLIDirectory()], {cwd: shopifyCLIDirectory()})
  await system.exec('bundle', ['install'], {cwd: shopifyCLIDirectory()})
}

async function bundleInstallThemeCheck() {
  await system.exec('bundle', ['config', 'set', '--local', 'path', themeCheckDirectory()], {cwd: themeCheckDirectory()})
  await system.exec('bundle', ['install'], {cwd: themeCheckDirectory()})
}

function shopifyCLIDirectory() {
  return join(constants.paths.directories.cache.vendor.path(), 'ruby-cli', RubyCLIVersion)
}

function themeCheckDirectory() {
  return join(constants.paths.directories.cache.vendor.path(), 'theme-check', ThemeCheckVersion)
}

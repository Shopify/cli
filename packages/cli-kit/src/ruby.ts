import * as file from './file'
import * as ui from './ui'
import * as system from './system'
import {Abort} from './error'
import {join} from './path'
import constants from './constants'
import {coerce} from './semver'
import {AdminSession} from './session'
import {local} from './environment'
// eslint-disable-next-line no-restricted-imports
import {spawn} from 'child_process'

const RubyCLIVersion = '2.16.0'
const ThemeCheckVersion = '1.10.2'
const MinBundlerVersion = '2.3.8'

/**
 * Execute CLI 2.0 commands.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args {string[]} List of argumets to execute. (ex: ['theme', 'pull'])
 * @param token {string} Token to pass to CLI 2.0, will be set as an environment variable
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

export async function execThemeCheckCLI(args: string[], adminSession?: AdminSession) {
  await installThemeCheckCLIDependencies()

  spawn('bundle', ['exec', 'theme-check'].concat(args), {
    stdio: 'inherit',
    shell: true,
    cwd: themeCheckDirectory(),
  })
}

/**
 * Validate Ruby Enviroment
 * Install RubyCLI and its dependencies
 * Shows a loading spinner if it's the first time installing dependencies
 * or if we are installing a new version of RubyCLI
 */
async function installThemeCheckCLIDependencies() {
  const exists = await file.exists(shopifyCLIDirectory())
  const renderer = local.isUnitTest() || exists ? 'silent' : 'default'

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
    {renderer},
  )
  await list.run()
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

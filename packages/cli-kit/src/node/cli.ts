// CLI
import {findUpAndReadPackageJson} from './node-package-manager.js'
import {errorHandler} from './error-handler.js'
import {isDevelopment} from '../environment/local.js'
import {isTruthy} from '../environment/utilities.js'
import constants from '../constants.js'
import {join, moduleDirectory} from '../path.js'
import {captureOutput, exec} from '../system.js'
import {run, settings, flush} from '@oclif/core'

interface RunCLIOptions {
  /** The value of import.meta.url of the CLI executable module */
  moduleURL: string
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param options {RunCLIOptions} Options.
 */
export async function runCLI(options: RunCLIOptions) {
  if (isDevelopment()) {
    settings.debug = true
  }

  run(undefined, options.moduleURL).then(flush).catch(errorHandler)
}

/**
 * A function for create-x CLIs that automatically runs the "init" command.
 * @param options
 */
export async function runCreateCLI(options: RunCLIOptions) {
  const packageJson = await findUpAndReadPackageJson(moduleDirectory(options.moduleURL))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageName = (packageJson.content as any).name as string
  const name = packageName.replace('@shopify/create-', '')
  const initIndex = process.argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex =
      process.argv.findIndex((arg) => arg.match(new RegExp(`bin(\\/|\\\\)+(create-${name}|dev|run)`))) + 1
    process.argv.splice(initIndex, 0, 'init')
  }
  await runCLI(options)
}

export async function useLocalCLIIfDetected(filepath: string): Promise<boolean> {
  // Temporary flag while we test out this feature and ensure it won't break anything!
  if (!isTruthy(process.env[constants.environmentVariables.enableCliRedirect])) return false

  // Setting an env variable in the child process prevents accidental recursion.
  if (isTruthy(process.env[constants.environmentVariables.skipCliRedirect])) return false

  // If already running via package manager, we can assume it's running correctly already.
  if (process.env.npm_config_user_agent) return false

  const cliPackage = await localCliPackage()
  if (!cliPackage) return false

  const correctExecutablePath = join(cliPackage.path, cliPackage.bin.shopify)
  if (correctExecutablePath === filepath) return false
  try {
    await exec(correctExecutablePath, process.argv.slice(2, process.argv.length), {
      stdio: 'inherit',
      env: {[constants.environmentVariables.skipCliRedirect]: '1'},
    })
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (processError: any) {
    process.exit(processError.exitCode)
  }
  return true
}

interface CliPackageInfo {
  path: string
  bin: {shopify: string}
}

interface PackageJSON {
  dependencies?: {[packageName: string]: CliPackageInfo}
  devDependencies?: {[packageName: string]: CliPackageInfo}
  peerDependencies?: {[packageName: string]: CliPackageInfo}
}

async function localCliPackage(): Promise<CliPackageInfo | undefined> {
  let npmListOutput = ''
  let localShopifyCLI: PackageJSON = {}
  try {
    npmListOutput = await captureOutput('npm', ['list', '@shopify/cli', '--json', '-l'])
    localShopifyCLI = JSON.parse(npmListOutput)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    return
  }
  const dependenciesList = {
    ...localShopifyCLI.peerDependencies,
    ...localShopifyCLI.devDependencies,
    ...localShopifyCLI.dependencies,
  }
  return dependenciesList['@shopify/cli']
}

export default runCLI

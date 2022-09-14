// CLI
import {isTruthy} from '../environment/utilities.js'
import constants from '../constants.js'
import {join} from '../path.js'
import {captureOutput, exec} from '../system.js'

interface RunCLIOptions {
  /** The value of import.meta.url of the CLI executable module */
  moduleURL: string
  development: boolean
}

function setupEnvironmentVariables(options: RunCLIOptions) {
  /**
   * By setting DEBUG=* when --verbose is passed we are increasing the
   * verbosity of oclif. Oclif uses debug (https://www.npmjs.com/package/debug)
   * for logging, and it's configured through the DEBUG= environment variable.
   */
  if (process.argv.includes('--verbose')) {
    process.env.DEBUG = process.env.DEBUG ?? '*'
  }
  if (options.development) {
    process.env.SHOPIFY_CLI_ENV = process.env.SHOPIFY_CLI_ENV ?? 'development'
  }
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param options {RunCLIOptions} Options.
 */
export async function runCLI(options: RunCLIOptions) {
  setupEnvironmentVariables(options)

  /**
   * These imports need to be dynamic because if they are static
   * they are loaded before se set the DEBUG=* environment variable
   * and therefore it has no effect.
   */
  const {errorHandler} = await import('./error-handler.js')
  const {isDevelopment} = await import('../environment/local.js')
  const {run, settings, flush} = await import('@oclif/core')

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
  /**
   * We need to call this method before we do any imports because they
   * migth transitively initialize debug and DEBUG=* has no effect then.
   */
  setupEnvironmentVariables(options)

  const {findUpAndReadPackageJson} = await import('./node-package-manager.js')
  const {moduleDirectory} = await import('../path.js')

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

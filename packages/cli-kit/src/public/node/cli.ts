/**
 * IMPORTANT NOTE: Imports in this module are dynamic to ensure that "setupEnvironmentVariables" can dynamically
 * set the DEBUG environment variable before the 'debug' package sets up its configuration when modules
 * are loaded statically.
 */
interface RunCLIOptions {
  /** The value of import.meta.url of the CLI executable module */
  moduleURL: string
  development: boolean
}

async function setupEnvironmentVariables(options: Pick<RunCLIOptions, 'development'>) {
  const {getEnvironmentVariables, setEnvironmentVariable} = await import('./environment.js')
  const env = getEnvironmentVariables()
  /**
   * By setting DEBUG=* when --verbose is passed we are increasing the
   * verbosity of oclif. Oclif uses debug (https://www.npmjs.com/package/debug)
   * for logging, and it's configured through the DEBUG= environment variable.
   */
  if (process.argv.includes('--verbose')) {
    setEnvironmentVariable('DEBUG', env.DEBUG ?? '*')
  }
  if (options.development) {
    setEnvironmentVariable('SHOPIFY_CLI_ENV', env.SHOPIFY_CLI_ENV ?? 'development')
  }
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param options - Options.
 */
export async function runCLI(options: RunCLIOptions) {
  await setupEnvironmentVariables(options)
  /**
   * These imports need to be dynamic because if they are static
   * they are loaded before we set the DEBUG=* environment variable
   * and therefore it has no effect.
   */
  const {errorHandler} = await import('./error-handler.js')
  const {isDevelopment} = await import('../../environment/local.js')
  const {run, settings, flush} = await import('@oclif/core')

  if (isDevelopment()) {
    settings.debug = true
  }

  run(undefined, options.moduleURL)
    .then(() => flush())
    .catch(errorHandler)
}

/**
 * A function for create-x CLIs that automatically runs the "init" command.
 */
export async function runCreateCLI(options: RunCLIOptions) {
  await setupEnvironmentVariables(options)

  const {findUpAndReadPackageJson} = await import('./node-package-manager.js')
  const {moduleDirectory} = await import('../../path.js')

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
  const {getEnvironmentVariables} = await import('./environment.js')
  const {isTruthy} = await import('../../environment/utilities.js')
  const constants = await import('../../constants.js')
  const {join} = await import('../../path.js')
  const {exec} = await import('../../system.js')
  const env = getEnvironmentVariables()

  // Temporary flag while we test out this feature and ensure it won't break anything!
  if (!isTruthy(env[constants.default.environmentVariables.enableCliRedirect])) return false

  // Setting an env variable in the child process prevents accidental recursion.
  if (isTruthy(env[constants.default.environmentVariables.skipCliRedirect])) return false

  // If already running via package manager, we can assume it's running correctly already.
  if (env.npm_config_user_agent) return false

  const cliPackage = await localCliPackage()
  if (!cliPackage) return false

  const correctExecutablePath = join(cliPackage.path, cliPackage.bin.shopify)
  if (correctExecutablePath === filepath) return false
  try {
    await exec(correctExecutablePath, process.argv.slice(2, process.argv.length), {
      stdio: 'inherit',
      env: {[constants.default.environmentVariables.skipCliRedirect]: '1'},
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

export async function localCliPackage(): Promise<CliPackageInfo | undefined> {
  const {captureOutput} = await import('../../system.js')

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

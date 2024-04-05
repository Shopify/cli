import {isTruthy} from './context/utilities.js'
import {printEventsJson} from '../../private/node/demo-recorder.js'
import {Flags} from '@oclif/core'
// eslint-disable-next-line @shopify/cli/specific-imports-in-bootstrap-code
import {fileURLToPath} from 'url'

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

async function warnIfOldNodeVersion() {
  const nodeVersion = process.versions.node
  const nodeMajorVersion = Number(nodeVersion.split('.')[0])

  const currentSupportedNodeVersion = 18
  if (nodeMajorVersion < currentSupportedNodeVersion) {
    const {renderWarning} = await import('./ui.js')
    renderWarning({
      headline: 'Upgrade to a supported Node version now.',
      body: [
        `Node ${nodeMajorVersion} has reached end-of-life and poses security risks. When you upgrade to a`,
        {
          link: {
            url: 'https://nodejs.dev/en/about/previous-releases',
            label: 'supported version',
          },
        },
        {char: ','},
        "you'll be able to use Shopify CLI without interruption.",
      ],
    })
  }
}

function setupEnvironmentVariables(options: Pick<RunCLIOptions, 'development'>) {
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

function forceNoColor() {
  if (
    process.argv.includes('--no-color') ||
    isTruthy(process.env.NO_COLOR) ||
    isTruthy(process.env.SHOPIFY_FLAG_NO_COLOR) ||
    process.env.TERM === 'dumb'
  ) {
    process.env.FORCE_COLOR = '0'
  }
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param options - Options.
 */
export async function runCLI(options: RunCLIOptions): Promise<void> {
  setupEnvironmentVariables(options)
  forceNoColor()
  await warnIfOldNodeVersion()
  /**
   * These imports need to be dynamic because if they are static
   * they are loaded before we set the DEBUG=* environment variable
   * and therefore it has no effect.
   */
  const {errorHandler} = await import('./error-handler.js')
  const {isDevelopment} = await import('./context/local.js')
  const {run, settings, flush, Errors} = await import('@oclif/core')
  const {ShopifyConfig} = await import('./custom-oclif-loader.js')

  if (isDevelopment()) {
    settings.debug = true
  }

  try {
    // Use a custom OCLIF config to customize the behavior of the CLI
    const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
    await config.load()

    await run(undefined, config)
    await flush()
    printEventsJson()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    await errorHandler(error as Error)
    return Errors.handle(error as Error)
  }
}

/**
 * A function for create-x CLIs that automatically runs the "init" command.
 */
export async function runCreateCLI(options: RunCLIOptions): Promise<void> {
  setupEnvironmentVariables(options)

  const {findUpAndReadPackageJson} = await import('./node-package-manager.js')
  const {moduleDirectory} = await import('./path.js')

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
  const {environmentVariables} = await import('../../private/node/constants.js')
  const {joinPath: join} = await import('./path.js')
  const {exec} = await import('./system.js')

  // Temporary flag while we test out this feature and ensure it won't break anything!
  if (!isTruthy(process.env[environmentVariables.enableCliRedirect])) return false

  // Setting an env variable in the child process prevents accidental recursion.
  if (isTruthy(process.env[environmentVariables.skipCliRedirect])) return false

  // If already running via package manager, we can assume it's running correctly already.
  if (process.env.npm_config_user_agent) return false

  const cliPackage = await localCliPackage()
  if (!cliPackage) return false

  const correctExecutablePath = join(cliPackage.path, cliPackage.bin.shopify)
  if (correctExecutablePath === filepath) return false
  try {
    await exec(correctExecutablePath, process.argv.slice(2, process.argv.length), {
      stdio: 'inherit',
      env: {[environmentVariables.skipCliRedirect]: '1'},
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
  const {captureOutput} = await import('./system.js')

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

/**
 * An object that contains the flags that
 * are shared across all the commands.
 */
export const globalFlags = {
  'no-color': Flags.boolean({
    hidden: false,
    description: 'Disable color output.',
    env: 'SHOPIFY_FLAG_NO_COLOR',
  }),
  verbose: Flags.boolean({
    hidden: false,
    description: 'Increase the verbosity of the logs.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
}

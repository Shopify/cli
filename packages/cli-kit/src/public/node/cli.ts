import {isTruthy} from './context/utilities.js'
import {launchCLI as defaultLaunchCli} from './cli-launcher.js'
import {cacheClear} from '../../private/node/conf-store.js'
import {environmentVariables} from '../../private/node/constants.js'
import {Flags} from '@oclif/core'

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

async function warnIfOldNodeVersion(versions: NodeJS.ProcessVersions = process.versions) {
  const nodeVersion = versions.node
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

function setupEnvironmentVariables(
  options: Pick<RunCLIOptions, 'development'>,
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
) {
  /**
   * By setting DEBUG=* when --verbose is passed we are increasing the
   * verbosity of oclif. Oclif uses debug (https://www.npmjs.com/package/debug)
   * for logging, and it's configured through the DEBUG= environment variable.
   */
  if (argv.includes('--verbose')) {
    env.DEBUG = env.DEBUG ?? '*'
  }
  if (options.development) {
    env.SHOPIFY_CLI_ENV = env.SHOPIFY_CLI_ENV ?? 'development'
  }
}

function forceNoColor(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env) {
  if (
    argv.includes('--no-color') ||
    isTruthy(env.NO_COLOR) ||
    isTruthy(env.SHOPIFY_FLAG_NO_COLOR) ||
    env.TERM === 'dumb'
  ) {
    env.FORCE_COLOR = '0'
  }
}

/**
 * A function that abstracts away setting up the environment and running
 * a CLI
 * @param options - Options.
 */
export async function runCLI(
  options: RunCLIOptions & {runInCreateMode?: boolean},
  launchCLI: (options: {moduleURL: string}) => Promise<void> = defaultLaunchCli,
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  versions: NodeJS.ProcessVersions = process.versions,
): Promise<void> {
  setupEnvironmentVariables(options, argv, env)
  if (options.runInCreateMode) {
    await addInitToArgvWhenRunningCreateCLI(options, argv)
  }
  forceNoColor(argv, env)
  await warnIfOldNodeVersion(versions)
  return launchCLI({moduleURL: options.moduleURL})
}

async function addInitToArgvWhenRunningCreateCLI(
  options: Pick<RunCLIOptions, 'moduleURL'>,
  argv: string[] = process.argv,
): Promise<void> {
  const {findUpAndReadPackageJson} = await import('./node-package-manager.js')
  const {moduleDirectory} = await import('./path.js')

  const packageJson = await findUpAndReadPackageJson(moduleDirectory(options.moduleURL))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageName = (packageJson.content as any).name as string
  const name = packageName.replace('@shopify/create-', '')
  const initIndex = argv.findIndex((arg) => arg.includes('init'))
  if (initIndex === -1) {
    const initIndex = argv.findIndex((arg) => arg.match(new RegExp(`bin(\\/|\\\\)+(create-${name}|dev|run)`))) + 1
    argv.splice(initIndex, 0, 'init')
  }
}

/**
 * A function for create-x CLIs that automatically runs the "init" command.
 */
export async function runCreateCLI(
  options: RunCLIOptions,
  launchCLI: (options: {moduleURL: string}) => Promise<void> = defaultLaunchCli,
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  versions: NodeJS.ProcessVersions = process.versions,
): Promise<void> {
  return runCLI({...options, runInCreateMode: true}, launchCLI, argv, env, versions)
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
    description: 'Increase the verbosity of the output.',
    env: 'SHOPIFY_FLAG_VERBOSE',
  }),
  tracing: Flags.boolean({
    hidden: true,
    description: 'Enable only network logs.',
    env: 'SHOPIFY_FLAG_TRACING',
  }),
}

export const jsonFlag = {
  json: Flags.boolean({
    char: 'j',
    description: 'Output the result as JSON.',
    hidden: false,
    default: false,
    env: environmentVariables.json,
  }),
}

/**
 * Clear the CLI cache, used to store some API responses and handle notifications status
 */
export function clearCache(): void {
  cacheClear()
}

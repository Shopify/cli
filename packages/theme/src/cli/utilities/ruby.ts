import {path, ui} from '@shopify/cli-kit'
import {exec} from '@shopify/cli-kit/node/system'
import {bundleExecutable, bundleInstallLocalShopifyCLI, validateRubyEnv} from '@shopify/cli-kit/node/ruby'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

interface ExecThemeCLIOptions {
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
 * Execute Theme CLI commands which is an embed simplified version of the CLI2.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args - List of argumets to execute. (ex: ['theme', 'pull']).
 * @param options - Options to customize the execution of cli2.
 */
export async function execCLI(args: string[], options: ExecThemeCLIOptions = {}): Promise<void> {
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
    BUNDLE_GEMFILE: path.join(await shopifyCLIDirectory(), 'Gemfile'),
  }

  try {
    await exec(bundleExecutable(), ['exec', 'shopify'].concat(args), {
      stdio: 'inherit',
      cwd: options.directory ?? process.cwd(),
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
 * Validate Ruby Enviroment
 * Install RubyCLI and its dependencies
 * Shows a loading spinner if it's the first time installing dependencies
 * or if we are installing a new version of RubyCLI.
 */
async function installCLIDependencies() {
  const list = ui.newListr(
    [
      {
        title: 'Installing theme dependencies',
        task: async () => {
          await validateRubyEnv()
          await bundleInstallLocalShopifyCLI(await shopifyCLIDirectory())
        },
      },
    ],
    {renderer: 'silent'},
  )
  await list.run()
}

/**
 * It returns the directory where the Ruby CLI is located.
 *
 * @returns The absolute path to the directory.
 */
async function shopifyCLIDirectory(): Promise<string> {
  return (await path.findUp('theme-cli', {
    type: 'directory',
    cwd: path.dirname(fileURLToPath(import.meta.url)),
  })) as string
}

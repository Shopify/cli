import {path, ui, output} from '@shopify/cli-kit'
import {exec} from '@shopify/cli-kit/node/system'
import {
  bundleExecutable,
  bundleInstallLocalShopifyCLI,
  validateRubyEnv,
  ExecCLI2Options,
  execCLI2,
} from '@shopify/cli-kit/node/ruby'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {fileURLToPath} from 'url'

/**
 * Execute Theme CLI commands which is an embed simplified version of the CLI2.
 * Installs a version of RubyCLI as a vendor dependency in a hidden folder in the system.
 * User must have a valid ruby+bundler environment to run any command.
 *
 * @param args - List of argumets to execute. (ex: ['theme', 'pull']).
 * @param options - Options to customize the execution of cli2.
 */
export async function execCLI(args: string[], options: ExecCLI2Options = {}): Promise<void> {
  if (process.env.SHOPIFY_CLI_THEME_CLI !== 'embed') await execCLI2(args, options)
  output.debug('Using embed Theme CLI')

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

import {fileExistsSync} from './fs.js'
import {cwd, joinPath, sniffForPath} from './path.js'
import {isDevelopment} from './context/local.js'
import {execaSync} from 'execa'
import {Command, Config} from '@oclif/core'
import {Options} from '@oclif/core/interfaces'

/**
 * Custom oclif Config subclass for the Shopify CLI.
 *
 * This extends the stock oclif Config with two changes:
 * 1. Hydrogen monorepo detection for dev mode (pre-existing, unrelated to lazy loading)
 * 2. Non-blocking init hooks — the 'init' event fires in the background so the CLI
 *    doesn't wait for plugin init hooks (app-init, hydrogen-init) before running commands.
 *    These hooks do background setup (clearing caches, setting env vars) that doesn't
 *    need to complete before the target command executes.
 */
export class ShopifyConfig extends Config {
  constructor(options: Options) {
    if (isDevelopment()) {
      // eslint-disable-next-line @shopify/cli/no-process-cwd
      const currentPath = cwd()

      let path = sniffForPath() ?? currentPath
      // Hydrogen CI uses `hydrogen/hydrogen` path, while local dev uses `shopify/hydrogen`.
      const currentPathMightBeHydrogenMonorepo = /(shopify|hydrogen)\/hydrogen/i.test(currentPath)
      const ignoreHydrogenMonorepo = process.env.IGNORE_HYDROGEN_MONOREPO
      if (currentPathMightBeHydrogenMonorepo && !ignoreHydrogenMonorepo) {
        path = execaSync('npm', ['prefix']).stdout.trim()
      }
      if (fileExistsSync(joinPath(path, 'package.json'))) {
        options.pluginAdditions = {
          core: ['@shopify/cli-hydrogen'],
          path,
        }
      }
    }

    super(options)

    if (isDevelopment()) {
      // @ts-expect-error: This is a private method that we are overriding. OCLIF doesn't provide a way to extend it.
      this.determinePriority = this.customPriority
    }
  }

  /**
   * Override runHook to make init hooks non-blocking for faster startup.
   * Init hooks (app-init, hydrogen-init) set up LocalStorage and check hydrogen —
   * these are setup tasks that don't need to complete before commands run.
   *
   * @param event - The hook event name.
   * @param opts - Options to pass to the hook.
   * @param timeout - Optional timeout for the hook.
   * @param captureErrors - Whether to capture errors instead of throwing.
   * @returns The hook result with successes and failures arrays.
   */
  // @ts-expect-error: overriding with looser types for hook interception
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async runHook(event: string, opts: any, timeout?: number, captureErrors?: boolean): Promise<any> {
    if (event === 'init' || event === 'prerun' || event === 'postrun') {
      // Fire init, prerun, and postrun hooks in background — they don't need to block.
      // - Init hooks: background setup (clearing caches, setting env vars)
      // - Prerun hooks: analytics tracking, upgrade checks (best-effort)
      // - Postrun hooks: analytics reporting (best-effort)
      // eslint-disable-next-line no-void
      void super.runHook(event, opts, timeout, captureErrors)
      return {successes: [], failures: []}
    }
    return super.runHook(event, opts, timeout, captureErrors)
  }

  /**
   * Custom priority logic for plugin commands.
   * In development mode, external cli-hydrogen commands take priority over bundled ones.
   *
   * @param commands - The commands to sort.
   * @returns The highest priority command.
   */
  customPriority(commands: Command.Loadable[]): Command.Loadable | undefined {
    const oclifPlugins = this.pjson.oclif.plugins ?? []
    const commandPlugins = commands.sort((aCommand, bCommand) => {
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasA = aCommand.pluginAlias ?? 'A-Cannot-Find-This'
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasB = bCommand.pluginAlias ?? 'B-Cannot-Find-This'
      const aIndex = oclifPlugins.indexOf(pluginAliasA)
      const bIndex = oclifPlugins.indexOf(pluginAliasB)

      // If there is an external cli-hydrogen plugin, its commands should take priority over bundled ('core') commands
      if (aCommand.pluginType === 'core' && bCommand.pluginAlias === '@shopify/cli-hydrogen') {
        return 1
      }

      if (aCommand.pluginAlias === '@shopify/cli-hydrogen' && bCommand.pluginType === 'core') {
        return -1
      }

      // All other cases are the default implementation from the private `determinePriority` method
      if (aCommand.pluginType === 'core' && bCommand.pluginType === 'core') {
        return aIndex - bIndex
      }

      if (bCommand.pluginType === 'core' && aCommand.pluginType !== 'core') {
        return 1
      }

      if (aCommand.pluginType === 'core' && bCommand.pluginType !== 'core') {
        return -1
      }

      if (aCommand.pluginType === 'jit' && bCommand.pluginType !== 'jit') {
        return 1
      }

      if (bCommand.pluginType === 'jit' && aCommand.pluginType !== 'jit') {
        return -1
      }

      return 0
    })
    return commandPlugins[0]
  }
}

import {fileExistsSync} from './fs.js'
import {cwd, joinPath, sniffForPath} from './path.js'
import {isDevelopment} from './context/local.js'
import {execaSync} from 'execa'
import {Command, Config} from '@oclif/core'
import {Options} from '@oclif/core/interfaces'

/**
 * Optional lazy command loader function.
 * If set, ShopifyConfig will use it to load individual commands on demand
 * instead of importing the entire COMMANDS module (which triggers loading all packages).
 */
export type LazyCommandLoader = (id: string) => Promise<typeof Command | undefined>

export class ShopifyConfig extends Config {
  private lazyCommandLoader?: LazyCommandLoader

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
        // Hydrogen is bundled, but we still want to support loading it as an external plugin for two reasons:
        // 1. To allow users to use an older version of Hydrogen. (to not force upgrades)
        // 2. To allow the Hydrogen team to load a local version for testing.
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
   * Set a lazy command loader that will be used to load individual command classes on demand,
   * bypassing the default oclif behavior of importing the entire COMMANDS module.
   *
   * @param loader - The lazy command loader function.
   */
  setLazyCommandLoader(loader: LazyCommandLoader): void {
    this.lazyCommandLoader = loader
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
    if (event === 'init' && this.lazyCommandLoader) {
      // Fire init hooks in background — they'll complete before process exits
      // eslint-disable-next-line no-void
      void super.runHook(event, opts, timeout, captureErrors)
      return {successes: [], failures: []}
    }
    return super.runHook(event, opts, timeout, captureErrors)
  }

  /**
   * Override runCommand to use lazy loading when available.
   * Instead of calling cmd.load() which triggers loading ALL commands via index.js,
   * we directly import only the needed command module.
   *
   * @param id - The command ID to run.
   * @param argv - The arguments to pass to the command.
   * @param cachedCommand - An optional cached command loadable.
   * @returns The command result.
   */
  async runCommand<T = unknown>(
    id: string,
    argv: string[] = [],
    cachedCommand: Command.Loadable | null = null,
  ): Promise<T> {
    if (this.lazyCommandLoader) {
      const cmd = cachedCommand ?? this.findCommand(id)
      if (cmd) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const commandClass = (await this.lazyCommandLoader(id)) as any
        if (commandClass) {
          commandClass.id = id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          commandClass.plugin = cmd.plugin ?? (this as any).rootPlugin
          // Execute the command first — give it exclusive CPU time.
          const result = (await commandClass.run(argv, this)) as T
          // Fire prerun + postrun AFTER command completes. Both are fire-and-forget.
          // Analytics is best-effort; process.exit(0) in bootstrap may terminate
          // before these complete, which is fine.
          // eslint-disable-next-line no-void
          void this.runHook('prerun', {argv, Command: commandClass}).then(() => {
            // eslint-disable-next-line no-void
            void this.runHook('postrun', {argv, Command: commandClass, result})
          })
          return result
        }
      }
    }
    return super.runCommand<T>(id, argv, cachedCommand)
  }

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
      // When both plugin types are 'core' plugins sort based on index
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

      // neither plugin is core, so do not change the order
      return 0
    })
    return commandPlugins[0]
  }
}

// Use native Node.js modules instead of cli-kit wrappers to avoid pulling in
// heavy dependency chains (fs.js → fs-extra, execa, etc.) that add ~550KB of chunks.
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {Command, Config} from '@oclif/core'
import {Options} from '@oclif/core/interfaces'

/**
 * Optional lazy command loader function.
 * If set, ShopifyConfig will use it to load individual commands on demand
 * instead of importing the entire COMMANDS module (which triggers loading all packages).
 */
export type LazyCommandLoader = (id: string) => Promise<typeof Command | undefined>

/**
 * Check if CLI is in development mode.
 * Inlined to avoid importing context/local.js and its dependency chain.
 */
function isDev(): boolean {
  return process.env.SHOPIFY_CLI_ENV === 'development'
}

/**
 * Extract --path flag value from argv.
 * Inlined to avoid importing path.js and its dependency chain.
 */
function sniffPath(argv = process.argv): string | undefined {
  const idx = argv.indexOf('--path')
  if (idx === -1) {
    const arg = argv.find((a) => a.startsWith('--path='))
    return arg?.split('=')[1]
  }
  const flag = argv[idx + 1]
  if (!flag || flag.startsWith('-')) return undefined
  return flag
}

export class ShopifyConfig extends Config {
  private lazyCommandLoader?: LazyCommandLoader

  constructor(options: Options) {
    if (isDev()) {
      const currentPath = process.cwd()

      let path = sniffPath() ?? currentPath
      // Hydrogen CI uses `hydrogen/hydrogen` path, while local dev uses `shopify/hydrogen`.
      const currentPathMightBeHydrogenMonorepo = /(shopify|hydrogen)\/hydrogen/i.test(currentPath)
      const ignoreHydrogenMonorepo = process.env.IGNORE_HYDROGEN_MONOREPO
      if (currentPathMightBeHydrogenMonorepo && !ignoreHydrogenMonorepo) {
        path = execFileSync('npm', ['prefix'], {encoding: 'utf8'}).trim()
      }
      if (existsSync(join(path, 'package.json'))) {
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

    if (isDev()) {
      // @ts-expect-error: This is a private method that we are overriding. OCLIF doesn't provide a way to extend it.

      this.determinePriority = this.customPriority
    }
  }

  /**
   * Set a lazy command loader that will be used to load individual command classes on demand,
   * bypassing the default oclif behavior of importing the entire COMMANDS module.
   */
  setLazyCommandLoader(loader: LazyCommandLoader): void {
    this.lazyCommandLoader = loader
  }

  /**
   * Override runHook to make init hooks non-blocking for faster startup.
   * Init hooks (app-init, hydrogen-init) set up LocalStorage and check hydrogen —
   * these are setup tasks that don't need to complete before commands run.
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
        const commandClass = await this.lazyCommandLoader(id) as any
        if (commandClass) {
          // Set the required properties on the command class
          commandClass.id = id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          commandClass.plugin = cmd.plugin ?? (this as any).rootPlugin
          // Fire prerun hook in background (analytics metadata setup).
          // Don't await - it runs in parallel with command execution.
          // By the time postrun needs the metadata, it will be ready.
          const prerunPromise = this.runHook('prerun', {argv, Command: commandClass})
          // Execute the command
          const result = (await commandClass.run(argv, this)) as T
          // Ensure prerun completed before postrun reads analytics metadata
          await prerunPromise
          // Fire postrun hook (analytics, deprecation checks) without blocking.
          // Analytics is best-effort; the user shouldn't wait for it.
          // eslint-disable-next-line no-void
          void this.runHook('postrun', {argv, Command: commandClass, result})
          return result
        }
      }
    }
    // Fall back to default behavior if lazy loader is not set or command not found
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
        // If b is hydrogen and a is core sort b first
        return 1
      }

      if (aCommand.pluginAlias === '@shopify/cli-hydrogen' && bCommand.pluginType === 'core') {
        // If a is hydrogen and b is core sort a first
        return -1
      }

      // All other cases are the default implementation from the private `determinePriority` method
      // When both plugin types are 'core' plugins sort based on index
      if (aCommand.pluginType === 'core' && bCommand.pluginType === 'core') {
        // If b appears first in the pjson.plugins sort it first
        return aIndex - bIndex
      }

      // if b is a core plugin and a is not sort b first
      if (bCommand.pluginType === 'core' && aCommand.pluginType !== 'core') {
        return 1
      }

      // if a is a core plugin and b is not sort a first
      if (aCommand.pluginType === 'core' && bCommand.pluginType !== 'core') {
        return -1
      }

      // if a is a jit plugin and b is not sort b first
      if (aCommand.pluginType === 'jit' && bCommand.pluginType !== 'jit') {
        return 1
      }

      // if b is a jit plugin and a is not sort a first
      if (bCommand.pluginType === 'jit' && aCommand.pluginType !== 'jit') {
        return -1
      }

      // neither plugin is core, so do not change the order
      return 0
    })
    return commandPlugins[0]
  }
}

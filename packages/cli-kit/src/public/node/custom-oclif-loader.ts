import {fileExistsSync} from './fs.js'
import {cwd, joinPath, sniffForPath} from './path.js'
import {isDevelopment} from './context/local.js'
import {execaSync} from 'execa'
import {Config} from '@oclif/core'
import {Options} from '@oclif/core/interfaces'

export class ShopifyConfig extends Config {
  constructor(options: Options) {
    if (isDevelopment()) {
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
        // Force OCLIF to ignore manifests so commands are loaded dynamically
        // to be replaced later
        options.ignoreManifest = true
      }
    }

    super(options)
  }

  async load(): Promise<void> {
    await super.load()

    if (!isDevelopment()) return

    // Let OCLIF load all commands first, then manually replace bundled hydrogen
    // commands with external ones after loading completes.
    const externalHydrogenPlugin = Array.from(this.plugins.values()).find(
      (plugin) => plugin.name === '@shopify/cli-hydrogen' && !plugin.isRoot,
    )

    if (!externalHydrogenPlugin) return

    if (typeof (this as {[key: string]: unknown})._commands === 'undefined') {
      throw new Error('ShopifyConfig: oclif internals changed. _commands is no longer available.')
    }

    // Extract _commands once to avoid repeated @ts-expect-error suppressions.
    // @ts-expect-error: _commands is private but we need to replace bundled commands
    const internalCommands = this._commands as Map<string, unknown>

    // Delete all bundled hydrogen command entries (canonical IDs, aliases, and hidden aliases)
    // before reloading from the external plugin. This mirrors oclif's own insertLegacyPlugins
    // pattern and ensures alias entries don't continue pointing to the bundled version.
    for (const command of externalHydrogenPlugin.commands) {
      if (!command.id.startsWith('hydrogen')) continue
      internalCommands.delete(command.id)
      const allAliases = [...(command.aliases ?? []), ...((command as {hiddenAliases?: string[]}).hiddenAliases ?? [])]
      for (const alias of allAliases) {
        internalCommands.delete(alias)
      }
    }

    // Let oclif's own loadCommands re-insert commands with proper alias and permutation
    // handling, mirroring the insertLegacyPlugins pattern used for legacy plugins.
    // @ts-expect-error: loadCommands is private but handles aliases/permutations correctly
    this.loadCommands(externalHydrogenPlugin)
  }
}

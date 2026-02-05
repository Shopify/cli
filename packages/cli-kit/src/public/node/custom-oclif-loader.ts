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

    if (isDevelopment()) {
      // Let OCLIF load all commands first, then manually replace bundled hydrogen
      // commands with external ones after loading completes.
      const externalHydrogenPlugin = Array.from(this.plugins.values()).find(
        (p) => p.name === '@shopify/cli-hydrogen' && !p.isRoot,
      )

      if (externalHydrogenPlugin) {
        for (const command of externalHydrogenPlugin.commands) {
          if (command.id.startsWith('hydrogen')) {
            // @ts-expect-error: _commands is private but we need to replace bundled commands
            if (this._commands.has(command.id)) {
              // @ts-expect-error: _commands is private but we need to replace bundled commands
              this._commands.set(command.id, command)
            }
          }
        }
      }
    }
  }
}

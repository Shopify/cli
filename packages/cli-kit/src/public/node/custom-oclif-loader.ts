import {Command, Config} from '@oclif/core'
import {Options} from '@oclif/core/lib/interfaces/plugin.js'

export class ShopifyConfig extends Config {
  constructor(options: Options) {
    super(options)
    // eslint-disable-next-line dot-notation
    this['determinePriority'] = (commands: Command.Loadable[]) => {
      console.log(commands)
      const isHydrogenCommand = commands.some((command) => command.id.startsWith('hydrogen:'))
      if (!isHydrogenCommand) return this.privateDeterminePriority(commands)

      // Hydrogen plugin should have higher priority than any hydrogen command defined in CLI
      // This is done so that the real `hydrogen:init` is called instead of the one defined in Global CLI
      const hydrogenPlugin = commands.find((command) => command.pluginAlias === '@shopify/cli-hydrogen')
      const bestChoice = hydrogenPlugin ?? this.privateDeterminePriority(commands)
      return bestChoice
    }
  }

  privateDeterminePriority(commands: Command.Loadable[]): Command.Loadable | undefined {
    const oclifPlugins = this.pjson.oclif?.plugins ?? []
    const commandPlugins = commands.sort((aCommand, bCommand) => {
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasA = aCommand.pluginAlias ?? 'A-Cannot-Find-This'
      // eslint-disable-next-line no-restricted-syntax
      const pluginAliasB = bCommand.pluginAlias ?? 'B-Cannot-Find-This'
      const aIndex = oclifPlugins.indexOf(pluginAliasA)
      const bIndex = oclifPlugins.indexOf(pluginAliasB)
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

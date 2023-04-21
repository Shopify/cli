import PluginsIndex from '@oclif/plugin-plugins/lib/commands/plugins/index.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Index extends Command {
  static hidden = true

  async run(): Promise<void> {
    await PluginsIndex.default.run(this.argv)
  }
}

import {commands} from '@oclif/plugin-plugins'
import Command from '@shopify/cli-kit/node/base-command'

export default class Index extends Command {
  static hidden = true

  async run(): Promise<void> {
    await commands.plugins.run(this.argv)
  }
}

import Command from '@shopify/cli-kit/node/base-command'
import {runCLIUpgrade} from '@shopify/cli-kit/node/upgrade'

export default class Upgrade extends Command {
  static summary = 'Upgrades Shopify CLI.'

  static descriptionWithMarkdown = 'Upgrades Shopify CLI using your package manager.'

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    await runCLIUpgrade()
  }
}

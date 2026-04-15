import Command from '@shopify/cli-kit/node/base-command'
import {promptAutoUpgrade, runCLIUpgrade} from '@shopify/cli-kit/node/upgrade'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Upgrade extends Command {
  static summary = 'Upgrades Shopify CLI.'

  static descriptionWithMarkdown = 'Upgrades Shopify CLI using your package manager.'

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    const accepted = await promptAutoUpgrade()
    await addPublicMetadata(() => ({env_auto_upgrade_accepted: accepted}))
    await runCLIUpgrade()
  }
}

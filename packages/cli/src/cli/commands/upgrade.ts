import Command from '@shopify/cli-kit/node/base-command'
import {upgradeCLI} from '@shopify/cli-kit/node/upgrade'
import {presentUpgradeResult} from '@shopify/cli-kit/node/upgrade/result'
import {upgradeJsonOutputSchema} from '@shopify/cli-kit/node/upgrade/types'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Upgrade extends Command {
  static summary = 'Upgrades Shopify CLI.'

  static descriptionWithMarkdown = 'Upgrades Shopify CLI using your package manager.'

  static description = this.descriptionForHelp()

  static flags = {...globalFlags, ...jsonFlag}

  static get jsonOutputSchema() {
    return upgradeJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade)
    const result = await upgradeCLI()
    presentUpgradeResult(result, flags.json ? 'json' : 'text')
  }
}

import {autoUpgradeStatus} from './constants.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutoupgradeOff extends Command {
  static summary = 'Disable automatic upgrades for Shopify CLI.'

  static descriptionWithMarkdown = `Disable automatic upgrades for Shopify CLI.

  When auto-upgrade is disabled, Shopify CLI won't automatically update. Run \`shopify upgrade\` to update manually.

  To enable auto-upgrade, run \`shopify config autoupgrade on\`.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    setAutoUpgradeEnabled(false)
    renderInfo({body: autoUpgradeStatus.off})
  }
}

import {autoUpgradeStatus} from './constants.js'
import {setAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutoupgradeOn extends Command {
  static summary = 'Enable automatic upgrades for Shopify CLI.'

  static descriptionWithMarkdown = `Enable automatic upgrades for Shopify CLI.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version once per day. Major version upgrades are skipped and must be done manually.

  To disable auto-upgrade, run \`shopify config autoupgrade off\`.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    setAutoUpgradeEnabled(true)
    renderInfo({body: autoUpgradeStatus.on})
  }
}

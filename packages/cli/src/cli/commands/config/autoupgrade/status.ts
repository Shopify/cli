import {autoUpgradeStatus} from './constants.js'
import {getAutoUpgradeEnabled} from '@shopify/cli-kit/node/upgrade'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutoupgradeStatus extends Command {
  static summary = 'Check whether auto-upgrade is enabled, disabled, or not yet configured.'

  static descriptionWithMarkdown = `Check whether auto-upgrade is enabled, disabled, or not yet configured.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version after each command.

  Run \`shopify config autoupgrade on\` or \`shopify config autoupgrade off\` to configure it.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    const enabled = getAutoUpgradeEnabled()
    if (enabled) {
      renderInfo({body: autoUpgradeStatus.on})
    } else {
      renderInfo({body: autoUpgradeStatus.off})
    }
  }
}

import {getAutoUpgradeStatus} from '../../../services/commands/config/autoupgrade/index.js'
import {presentAutoUpgradeResult} from '../../../services/commands/config/autoupgrade/result.js'
import {autoUpgradeJsonOutputSchema} from '../../../services/commands/config/autoupgrade/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class AutoupgradeStatus extends Command {
  static summary = 'Check whether auto-upgrade is enabled, disabled, or not yet configured.'

  static descriptionWithMarkdown = `Check whether auto-upgrade is enabled, disabled, or not yet configured.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version after each command.

  Run \`shopify config autoupgrade on\` or \`shopify config autoupgrade off\` to configure it.
`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return autoUpgradeJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AutoupgradeStatus)
    const result = getAutoUpgradeStatus()
    presentAutoUpgradeResult(result, flags.json ? 'json' : 'text')
  }
}

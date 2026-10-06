import {configureAutoUpgrade} from '../../../services/commands/config/autoupgrade/index.js'
import {presentAutoUpgradeResult} from '../../../services/commands/config/autoupgrade/result.js'
import {autoUpgradeJsonOutputSchema} from '../../../services/commands/config/autoupgrade/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class AutoupgradeOff extends Command {
  static summary = 'Disable automatic upgrades for Shopify CLI.'

  static descriptionWithMarkdown = `Disable automatic upgrades for Shopify CLI.

  When auto-upgrade is disabled, Shopify CLI won't automatically update. Run \`shopify upgrade\` to update manually.

  To enable auto-upgrade, run \`shopify config autoupgrade on\`.
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
    const {flags} = await this.parse(AutoupgradeOff)
    const result = configureAutoUpgrade(false)
    presentAutoUpgradeResult(result, flags.json ? 'json' : 'text')
  }
}

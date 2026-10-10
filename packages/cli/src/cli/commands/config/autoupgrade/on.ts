import {configureAutoUpgrade} from '../../../services/commands/config/autoupgrade/index.js'
import {presentAutoUpgradeResult} from '../../../services/commands/config/autoupgrade/result.js'
import {autoUpgradeJsonOutputSchema} from '../../../services/commands/config/autoupgrade/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class AutoupgradeOn extends Command {
  static summary = 'Enable automatic upgrades for Shopify CLI.'

  static descriptionWithMarkdown = `Enable automatic upgrades for Shopify CLI.

  When auto-upgrade is enabled, Shopify CLI automatically updates to the latest version once per day. Major version upgrades are skipped and must be done manually.

  To disable auto-upgrade, run \`shopify config autoupgrade off\`.
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
    const {flags} = await this.parse(AutoupgradeOn)
    const result = configureAutoUpgrade(true)
    presentAutoUpgradeResult(result, flags.json ? 'json' : 'text')
  }
}

import {autocorrectStatus} from '../../../services/constants.js'
import {isAutocorrectEnabled} from '../../../services/conf.js'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutocorrectStatus extends Command {
  static summary = 'Check whether autocorrect is enabled or disabled. On by default.'

  static descriptionWithMarkdown = `Check whether autocorrect is enabled or disabled. On by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    if (isAutocorrectEnabled()) {
      renderInfo({body: autocorrectStatus.on})
    } else {
      renderInfo({body: autocorrectStatus.off})
    }
  }
}

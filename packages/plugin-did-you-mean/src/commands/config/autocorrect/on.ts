import {autocorrectStatus} from '../../../services/constants.js'
import {setAutocorrect} from '../../../services/conf.js'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutocorrectOn extends Command {
  static summary = 'Enable autocorrect. Off by default.'

  static descriptionWithMarkdown = `Enable autocorrect. Off by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    setAutocorrect(true)
    renderInfo({body: autocorrectStatus.on})
  }
}

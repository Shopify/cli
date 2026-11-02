import {configureAutocorrect} from '../../../services/autocorrect/index.js'
import {presentAutocorrectResult} from '../../../services/autocorrect/result.js'
import {autocorrectJsonOutputSchema} from '../../../services/autocorrect/types.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class AutocorrectOn extends Command {
  static summary = 'Enable autocorrect. Off by default.'

  static descriptionWithMarkdown = `Enable autocorrect. Off by default.

  When autocorrection is enabled, Shopify CLI automatically runs a corrected version of your command if a correction is available.

  When autocorrection is disabled, you need to confirm that you want to run corrections for mistyped commands.
`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return autocorrectJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AutocorrectOn)
    const result = configureAutocorrect(true)
    presentAutocorrectResult(result, flags.json ? 'json' : 'text')
  }
}

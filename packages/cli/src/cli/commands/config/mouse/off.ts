import {mouseStatus} from './constants.js'
import {mouseJsonOutputSchema} from '../../../services/commands/config/mouse/types.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class MouseOff extends Command {
  static summary = 'Disable mouse interactions in Shopify CLI.'

  static descriptionWithMarkdown = `Disable mouse interactions in Shopify CLI.

  When mouse interactions are disabled, standard terminal text selection and scrolling are restored.

  To enable clickable prompt options and app dev tabs, run \`shopify config mouse on\`.
`

  static description = this.descriptionForHelp()

  static flags = {
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return mouseJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MouseOff)
    setMouseEnabled(false)
    if (flags.json) {
      outputResult(mouseJsonOutputSchema.encode({enabled: false}))
    } else {
      renderInfo({body: mouseStatus.off})
    }
  }
}

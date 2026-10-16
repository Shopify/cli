import {mouseStatus} from './constants.js'
import {mouseJsonOutputSchema} from '../../../services/commands/config/mouse/types.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import Command from '@shopify/cli-kit/node/base-command'
import {jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class MouseOn extends Command {
  static summary = 'Enable mouse interactions in Shopify CLI.'

  static descriptionWithMarkdown = `Enable mouse interactions in Shopify CLI.

  Mouse interactions are enabled by default and allow you to click prompt options and app dev tabs. To select text while they are enabled, hold Option in iTerm2 or Shift in most other terminals while dragging.

  To restore standard terminal text selection and scrolling, run \`shopify config mouse off\`.
`

  static description = this.descriptionForHelp()

  static flags = {
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return mouseJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MouseOn)
    setMouseEnabled(true)
    if (flags.json) {
      outputResult(mouseJsonOutputSchema.encode({enabled: true}))
    } else {
      renderInfo({body: mouseStatus.on})
    }
  }
}

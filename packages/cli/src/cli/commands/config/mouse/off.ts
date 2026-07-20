import {mouseStatus} from './constants.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class MouseOff extends Command {
  static summary = 'Disable mouse interactions in Shopify CLI.'

  static descriptionWithMarkdown = `Disable mouse interactions in Shopify CLI.

  When mouse interactions are disabled, standard terminal text selection and scrolling are restored.

  To enable clickable prompt options and app dev tabs, run \`shopify config mouse on\`.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    setMouseEnabled(false)
    renderInfo({body: mouseStatus.off})
  }
}

import {mouseStatus} from './constants.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class MouseOn extends Command {
  static summary = 'Enable mouse interactions in Shopify CLI.'

  static descriptionWithMarkdown = `Enable mouse interactions in Shopify CLI.

  Mouse interactions are enabled by default and allow you to click prompt options and app dev tabs. To select text while they are enabled, hold Option in iTerm2 or Shift in most other terminals while dragging.

  To restore standard terminal text selection and scrolling, run \`shopify config mouse off\`.
`

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    setMouseEnabled(true)
    renderInfo({body: mouseStatus.on})
  }
}

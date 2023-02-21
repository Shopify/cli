import {autocorrectStatus} from '../../../services/constants.js'
import {setAutocorrect} from '../../../services/conf.js'
import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class AutocorrectOn extends Command {
  static description = 'Enable autocorrect.'

  async run(): Promise<void> {
    setAutocorrect(true)
    renderInfo({body: autocorrectStatus.on})
  }
}

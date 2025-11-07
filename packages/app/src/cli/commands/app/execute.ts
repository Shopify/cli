import {appFlags} from '../../flags.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../utilities/app-unlinked-command.js'
import {AppInterface} from '../../models/app/app.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class Execute extends AppUnlinkedCommand {
  static summary = 'Execute app operations.'

  static description = 'Execute app operations.'

  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  async run(): Promise<AppUnlinkedCommandOutput> {
    await this.parse(Execute)

    renderSuccess({
      headline: 'Execute command ran successfully!',
      body: 'Placeholder command. Add execution logic here.',
    })

    return {app: undefined as unknown as AppInterface}
  }
}

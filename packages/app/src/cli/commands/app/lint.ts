import {appFlags} from '../../flags.js'
import {lint} from '../../services/lint.js'
import {loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
// import metadata from '../../metadata.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
// import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Lint extends Command {
  static description = 'Lint your Shopify app for common reasons to reject from the app store.'

  static flags = {
    ...globalFlags,
    ...appFlags,
 }

  async run(): Promise<void> {
    const {flags} = await this.parse(Lint)

    const app = await loadApp({directory: flags.path, configName: flags.config})

    await lint(app)
  }
}

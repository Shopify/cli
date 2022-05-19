import {appFlags} from '../../flags'
import {deploy} from '../../services/deploy'
import {App, load as loadApp} from '../../models/app/app'
import {Command} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'

export default class Deploy extends Command {
  static description = 'Deploy your Shopify app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Deploy)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await deploy({app})
  }
}

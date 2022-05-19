import {appFlags} from '../../flags'
import {App, load as loadApp} from '../../models/app/app'
import build from '../../services/build'
import {Command} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Build the app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await build({app})
  }
}

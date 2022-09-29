import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {showEnv} from '../../../services/app/env/show.js'
import Command from '../../../utilities/app-command.js'
import {output, path, cli} from '@shopify/cli-kit'

export default class EnvShow extends Command {
  static description = 'Display app and extensions environment variables'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvShow)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const envFile = path.resolve(directory)
    const app: AppInterface = await loadApp(directory, 'report')
    output.info(await showEnv(app))
  }
}

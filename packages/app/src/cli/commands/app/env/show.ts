import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {showEnv} from '../../../services/app/env/show.js'
import Command from '../../../utilities/app-command.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class EnvShow extends Command {
  static description = 'Display app and extensions environment variables.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvShow)
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path, mode: 'report'})
    outputInfo(await showEnv(app))
  }
}

import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {showEnv} from '../../../services/app/env/show.js'
import Command from '../../../utilities/app-command.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {output} from '@shopify/cli-kit'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class EnvShow extends Command {
  static description = 'Display app and extensions environment variables.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvShow)
    const directory = flags.path ? resolvePath(flags.path) : cwd()
    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({directory, specifications, mode: 'report'})
    output.info(await showEnv(app))
  }
}

import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {loadApp} from '../../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {showEnv} from '../../../services/app/env/show.js'
import Command from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class EnvShow extends Command {
  static summary = 'Display app and extensions environment variables.'

  static descriptionWithMarkdown = `Displays environment variables that can be used to deploy apps and app extensions.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvShow)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      configName: flags.config,
      mode: 'report',
    })
    outputInfo(await showEnv(app))
  }
}

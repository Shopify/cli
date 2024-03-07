import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {getDotEnvFileName, loadApp} from '../../../models/app/loader.js'
import {pullEnv} from '../../../services/app/env/pull.js'
import Command from '../../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

export default class EnvPull extends Command {
  static summary = 'Pull app and extensions environment variables.'

  static descriptionWithMarkdown = `Creates or updates an \`.env\` files that contains app and app extension environment variables.

  When an existing \`.env\` file is updated, changes to the variables are displayed in the terminal output. Existing variables and commented variables are preserved.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'env-file': Flags.string({
      hidden: false,
      description: 'Specify an environment file to update if the update flag is set',
      env: 'SHOPIFY_FLAG_ENV_FILE',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(EnvPull)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      configName: flags.config,
      mode: 'report',
    })
    const envFile = joinPath(app.directory, flags['env-file'] ?? getDotEnvFileName(app.configuration.path))
    outputInfo(await pullEnv(app, {envFile}))
  }
}

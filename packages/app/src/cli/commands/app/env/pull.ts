import {appFlags} from '../../../flags.js'
import {getDotEnvFileName} from '../../../models/app/loader.js'
import {pullEnv} from '../../../services/app/env/pull.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

export default class EnvPull extends AppLinkedCommand {
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

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(EnvPull)

    const {app, remoteApp, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const envFile = joinPath(app.directory, flags['env-file'] ?? getDotEnvFileName(app.configuration.path))
    outputResult(await pullEnv({app, remoteApp, organization, envFile}))
    return {app}
  }
}

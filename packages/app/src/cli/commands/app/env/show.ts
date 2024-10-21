import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {showEnv} from '../../../services/app/env/show.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class EnvShow extends AppCommand {
  static summary = 'Display app and extensions environment variables.'

  static descriptionWithMarkdown = `Displays environment variables that can be used to deploy apps and app extensions.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(EnvShow)
    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: flags.config,
    })
    outputInfo(await showEnv(app, remoteApp))
    return {app}
  }
}

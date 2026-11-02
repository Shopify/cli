import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {getAppEnv} from '../../../services/app/env/show.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {appEnvShowJsonOutputSchema} from '../../../services/app/env/show/types.js'
import {renderAppEnvShowResult} from '../../../services/app/env/show/result.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class EnvShow extends AppLinkedCommand {
  static summary = 'Display app and extensions environment variables.'

  static descriptionWithMarkdown = `Displays environment variables that can be used to deploy apps and app extensions.`

  static get jsonOutputSchema() {
    return appEnvShowJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...appFlags,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(EnvShow)
    const {app, remoteApp, organization} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const result = await getAppEnv(app, remoteApp, organization)
    renderAppEnvShowResult(result, flags.json ? 'json' : 'text')
    return {app}
  }
}

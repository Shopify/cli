import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {sources} from '../../../services/app-logs/sources.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Sources extends AppCommand {
  static summary = 'Print out a list of sources that may be used with the logs command.'

  static descriptionWithMarkdown = `The output source names can be used with the \`--source\` argument of \`shopify app logs\` to filter log output. Currently only function extensions are supported as sources.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Sources)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: flags.config,
    })

    if (app.errors) {
      process.exit(2)
    } else {
      sources(app)
    }
    return {app}
  }
}

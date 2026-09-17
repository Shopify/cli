import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {sources} from '../../../services/app-logs/sources.js'
import {appLogSourcesJsonOutputSchema} from '../../../services/app-logs/sources/types.js'
import {renderAppLogSourcesResult} from '../../../services/app-logs/sources/result.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Sources extends AppLinkedCommand {
  static summary = 'Print out a list of sources that may be used with the logs command.'

  static descriptionWithMarkdown = `The output source names can be used with the \`--source\` argument of \`shopify app logs\` to filter log output. Currently only function extensions are supported as sources.`

  static get jsonOutputSchema() {
    return appLogSourcesJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Sources)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    if (app.errors.isEmpty()) {
      renderAppLogSourcesResult(sources(app), flags.json ? 'json' : 'text')
    } else {
      process.exit(2)
    }
    return {app}
  }
}

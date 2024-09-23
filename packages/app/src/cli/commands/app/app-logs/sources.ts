import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {loadApp} from '../../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {sources} from '../../../services/app-logs/sources.js'
import AppCommand from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Sources extends AppCommand {
  static summary = 'Print out a list of sources that may be used with the logs command.'

  static descriptionWithMarkdown = `The output source names can be used with the \`--source\` argument of \`shopify app logs\` to filter log output. Currently only function extensions are supported as sources.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Sources)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
      mode: 'report',
    })

    if (app.errors) {
      process.exit(2)
    } else {
      sources(app)
    }
  }
}

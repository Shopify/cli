import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import versionList from '../../../services/versions-list.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args, Flags} from '@oclif/core'

export default class VersionsList extends Command {
  static description = 'List deployed versions of your app.'
  static examples = ['<%= config.bin %> <%= command.id %>']

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: false,
      description: "Application's API key to fetch versions for.",
      env: 'SHOPIFY_FLAG_API_KEY',
    }),
  }

  static args = {
    file: Args.string(),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(VersionsList)
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path})

    await versionList({app, apiKey: flags['api-key']})
  }
}

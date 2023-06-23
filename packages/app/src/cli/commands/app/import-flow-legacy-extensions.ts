import {appFlags} from '../../flags.js'
import {loadExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {load as loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {importFlowExtensions} from '../../services/import-flow-legacy-extensions.js'
import {Command, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class AppImportFlowExtension extends Command {
  static description = 'Deploy your Shopify app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AppImportFlowExtension)

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path})

    await importFlowExtensions({app, apiKey: flags['api-key'], config: this.config, reset: flags.reset})
  }
}

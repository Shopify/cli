import {appFlags} from '../../flags.js'
import {loadExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {load as loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {importFlowExtensions} from '../../services/import-flow-legacy-extensions.js'
import Command from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class AppImportFlowExtension extends Command {
  static description = 'Import dashboard-managed flow extensions into your app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AppImportFlowExtension)

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path})

    await importFlowExtensions({app, config: this.config, apiKey: flags['client-id']})
  }
}

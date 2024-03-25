import {buildTomlObject} from '../../services/payments/extension-to-toml.js'
import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {importDashboardExtensions} from '../../services/import-dashboard-extensions.js'
import Command from '../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class AppImportPaymentsExtension extends Command {
  static description = 'Import dashboard-managed payments extensions into your app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AppImportPaymentsExtension)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({specifications, directory: flags.path, configName: flags.config})

    const paymentsExtensionType = 'payments_extension'
    await importDashboardExtensions({
      app,
      apiKey: flags['client-id'],
      extensionTypes: [paymentsExtensionType],
      buildTomlObject,
    })
  }
}

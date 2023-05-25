import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import Command from '../../../utilities/app-command.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/specifications.js'
import {writeExistingFlowDashboardExtensions} from '../../../services/write_existing_flow_dashboard_extensions.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class AppMigrateExtension extends Command {
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
    force: Flags.boolean({
      hidden: false,
      description: 'Deploy without asking for confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
      default: false,
    }),
    label: Flags.string({
      // we can make this visible once we've rolled out unified deployments
      hidden: true,
      description: 'The deployment label. Will be shown in the Partners Dashboard.',
      env: 'SHOPIFY_FLAG_LABEL',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AppMigrateExtension)

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path})

    await writeExistingFlowDashboardExtensions({
      app,
      apiKey: flags['api-key'],
      reset: flags.reset,
      force: flags.force,
      label: flags.label,
    })
    // await migrate({app, apiKey: flags['api-key'], reset: flags.reset, force: flags.force, label: flags.label})
  }
}

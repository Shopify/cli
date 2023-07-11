import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {release} from '../../services/release.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Release extends Command {
  static description = 'Release an app version.'

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
    version: Flags.string({
      hidden: false,
      description: 'The name of the app version to release.',
      env: 'SHOPIFY_FLAG_VERSION',
      exclusive: ['app-version-id'],
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Release)

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path, configName: flags.config})
    await release({
      app,
      apiKey: flags['api-key'],
      reset: flags.reset,
      force: flags.force,
      version: flags.version,
    })
  }
}

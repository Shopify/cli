import {appFlags} from '../../../flags.js'
import {loadAppConfiguration} from '../../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import use from '../../../services/app/config/use.js'
import Command from '../../../utilities/app-command.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

// This is one of the few commands where we don't need a
// `--config` flag, because we're passing it as an argument.
const {config, ...appFlagsWithoutConfig} = appFlags

export default class ConfigUse extends Command {
  static description = 'Activate an app configuration.'

  static flags = {
    ...globalFlags,
    ...appFlagsWithoutConfig,
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset current configuration.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
  }

  static args = {
    // we want to this argument to be optional so that the user
    // can also select one from the list of available app tomls.
    config: Args.string({
      description: "The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.",
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(ConfigUse)
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    // eslint-disable-next-line @shopify/cli/required-fields-when-loading-app
    const localApp = await loadAppConfiguration({
      directory: flags.path,
      specifications,
    })

    await use({directory: localApp.directory, configName: args.config, reset: flags.reset, specifications})
  }
}

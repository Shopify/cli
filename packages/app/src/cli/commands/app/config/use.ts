import {appFlags} from '../../../flags.js'
import {checkFolderIsValidApp} from '../../../models/app/loader.js'
import {linkedAppContext} from '../../../services/app-context.js'
import use from '../../../services/app/config/use.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {Args} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

// This is one of the few commands where we don't need a
// `--config` flag, because we're passing it as an argument.
const {config, ...appFlagsWithoutConfig} = appFlags

export default class ConfigUse extends AppCommand {
  static summary = 'Activate an app configuration.'

  static descriptionWithMarkdown = `Sets default configuration when you run app-related CLI commands. If you omit the \`config-name\` parameter, then you'll be prompted to choose from the configuration files in your project.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlagsWithoutConfig,
  }

  static args = {
    // we want to this argument to be optional so that the user
    // can also select one from the list of available app tomls.
    config: Args.string({
      description: "The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.",
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags, args} = await this.parse(ConfigUse)

    await checkFolderIsValidApp(flags.path)
    await use({directory: flags.path, configName: args.config, reset: flags.reset})

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: args.config,
    })

    return {app}
  }
}

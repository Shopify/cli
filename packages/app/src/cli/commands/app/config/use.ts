import {appFlags} from '../../../flags.js'
import {checkFolderIsValidApp} from '../../../models/app/loader.js'
import {localAppContext} from '../../../services/app-context.js'
import {useAppConfiguration} from '../../../services/app/config/use.js'
import {appConfigUseJsonOutputSchema} from '../../../services/app/config/use/types.js'
import {renderAppConfigUseResult} from '../../../services/app/config/use/result.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {Args} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

// This is one of the few commands where we don't need a
// `--config` flag, because we're passing it as an argument.
const {config, ...appFlagsWithoutConfig} = appFlags

export default class ConfigUse extends AppUnlinkedCommand {
  static summary = 'Activate an app configuration.'

  static descriptionWithMarkdown = `Sets default configuration when you run app-related CLI commands. If you omit the \`config-name\` parameter, then you'll be prompted to choose from the configuration files in your project.`

  static get jsonOutputSchema() {
    return appConfigUseJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static usage = `app config use [config] [flags]`

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...appFlagsWithoutConfig,
  }

  static args = {
    // we want to this argument to be optional so that the user
    // can also select one from the list of available app tomls.
    config: Args.string({
      description: "The name of the app configuration. Can be 'shopify.app.staging.toml' or simply 'staging'.",
    }),
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags, args} = await this.parse(ConfigUse)

    const {app} = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: args.config,
    })

    await checkFolderIsValidApp(flags.path)
    const result = await useAppConfiguration({directory: flags.path, configName: args.config, reset: flags.reset})
    await renderAppConfigUseResult(result, flags.path, flags.json ? 'json' : 'text')

    return {app}
  }
}

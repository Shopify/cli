import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends AppCommand {
  static summary = 'Fetch your app configuration from the Partner Dashboard.'

  static descriptionWithMarkdown = `Pulls app configuration from the Partner Dashboard and creates or overwrites a configuration file. You can create a new app with this command to start with a default configuration file.

  For more information on the format of the created TOML configuration file, refer to the [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration) page.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
      configName: flags.config,
    }

    const result = await link(options)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: result.state.configurationFileName,
    })

    return {app}
  }
}

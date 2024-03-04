import {appFlags} from '../../../flags.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import Command from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends Command {
  static summary = 'Fetch your app configuration from the Partner Dashboard.'

  static description = `Pulls app configuration from the Partner Dashboard and creates or overwrites a configuration file. You can create a new app with this command to start with a default configuration file.

  This command presents you with a prompt with the following steps:

  - Which Partner organization is this work for?
    - This prompt shows only if the account you are logged into has more than one organization.
  - Create this project as a new app on Shopify?
    - Choosing yes will create a new app in your Partner Dashboard with the default configuration
    - Choosing no will prompt you to choose from a list of all the apps in your organization
  - Configuration file name
    - Enter the name for this configuration file. The \`shopify.app.{config-name}.toml\` file will be created. If it already exists, you will be prompted to confirm overwriting.

  For more information on the format of the created TOML configuration file, refer to the [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration) page.
  `

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
    }
    await link(options)
  }
}

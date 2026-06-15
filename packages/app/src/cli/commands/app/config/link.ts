import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends AppLinkedCommand {
  static summary = 'Fetch your app configuration from the Developer Dashboard.'

  static descriptionWithMarkdown = `Pulls app configuration from the Developer Dashboard and creates or overwrites a configuration file. You can create a new app with this command to start with a default configuration file.

  For more information on the format of the created TOML configuration file, refer to the [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration) page.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'organization-id': Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      exclusive: ['client-id'],
    }),
    'new-app-name': Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_NEW_APP_NAME',
      exclusive: ['client-id'],
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
      organizationId: flags['organization-id'],
      newAppName: flags['new-app-name'],
      configName: flags.config,
    }

    const result = await link(options)

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: result.configFileName,
    })

    return {app}
  }
}

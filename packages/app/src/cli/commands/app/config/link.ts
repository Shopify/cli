import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {linkAppConfiguration, LinkOptions} from '../../../services/app/config/link.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {appConfigLinkJsonOutputSchema} from '../../../services/app/config/link/types.js'
import {renderAppConfigLinkResult} from '../../../services/app/config/link/result.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends AppLinkedCommand {
  static summary = 'Fetch your app configuration from the Developer Dashboard.'

  static descriptionWithMarkdown = `Pulls app configuration from the Developer Dashboard and creates or overwrites a configuration file. You can create a new app with this command to start with a default configuration file.

  For more information on the format of the created TOML configuration file, refer to the [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration) page.
  `

  static get jsonOutputSchema() {
    return appConfigLinkJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...appFlags,
    'organization-id': Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      exclusive: ['client-id'],
    }),
    'client-id': requiredIfNonInteractive(appFlags['client-id']),
    'file-name': Flags.string({
      hidden: false,
      description: 'The name of the app configuration file to create or overwrite.',
      env: 'SHOPIFY_FLAG_APP_CONFIG_FILE_NAME',
      exclusive: ['config'],
    }),
    force: Flags.boolean({
      hidden: false,
      description: 'Overwrite an existing configuration file without prompting.',
      env: 'SHOPIFY_FLAG_FORCE',
      dependsOn: ['file-name'],
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
      organizationId: flags['organization-id'],
      configName: flags.config,
      fileName: flags['file-name'],
      force: flags.force ?? false,
    }

    const result = await linkAppConfiguration(options)
    if (!flags.json) renderAppConfigLinkResult(result.result, result.packageManager, 'text')

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: result.configFileName,
    })

    // JSON must wait until all command work succeeds, so a later failure cannot emit a second document.
    if (flags.json) renderAppConfigLinkResult(result.result, result.packageManager, 'json')

    return {app}
  }
}

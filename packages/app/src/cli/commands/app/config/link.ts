import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {Flags} from '@oclif/core'
import {globalFlags, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class ConfigLink extends AppLinkedCommand {
  static summary = 'Fetch your app configuration from the Developer Dashboard.'

  static descriptionWithMarkdown = `Pulls app configuration from the Developer Dashboard and creates or overwrites a configuration file. You can create a new app with this command to start with a default configuration file.

  For more information on the format of the created TOML configuration file, refer to the [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration) page.
  `

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    config: Flags.string({
      hidden: false,
      char: 'c',
      description:
        'The name of the local app configuration to read and overwrite. Use --file-name instead when specifying --client-id.',
      env: 'SHOPIFY_FLAG_APP_CONFIG',
    }),
    'organization-id': Flags.string({
      hidden: true,
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      exclusive: ['client-id'],
    }),
    // Validate this conflict in run() so we can recommend --file-name.
    'client-id': requiredIfNonInteractive(
      Flags.string({
        hidden: false,
        description:
          'The Client ID of the remote app to link. Use --file-name to specify the destination configuration file.',
        env: 'SHOPIFY_FLAG_CLIENT_ID',
      }),
    ),
    'file-name': Flags.string({
      hidden: false,
      description:
        'The name of the app configuration file to create or overwrite. Requires --force to overwrite an existing file.',
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

    if (flags.config !== undefined && flags['client-id'] !== undefined) {
      throw new AbortError(
        "The --config and --client-id flags can't be used together.",
        'Use --file-name instead of --config to choose the configuration file to create or overwrite.',
      )
    }

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
      organizationId: flags['organization-id'],
      configName: flags.config,
      fileName: flags['file-name'],
      force: flags.force ?? false,
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

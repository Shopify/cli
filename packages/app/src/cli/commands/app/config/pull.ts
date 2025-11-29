import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import pull from '../../../services/app/config/pull.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigPull extends AppLinkedCommand {
  static summary = 'Refresh an already-linked app configuration without prompts.'

  static descriptionWithMarkdown = `Pulls the latest configuration from the already-linked Shopify app and updates the selected configuration file.

This command reuses the existing linked app and organization and skips all interactive prompts. Use \`--config\` to target a specific configuration file, or omit it to use the default one.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ConfigPull)

    const {app, remoteApp} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const {configuration} = await pull({
      directory: flags.path,
      configName: flags.config,
      configuration: app.configuration,
      remoteApp,
    })

    renderSuccess({
      headline: `Pulled latest configuration for "${configuration.name}"`,
      body: `Updated ${configuration.path ?? flags.config ?? 'app configuration'} using the already-linked app "${
        remoteApp.title
      }".`,
      nextSteps: [
        [
          'To deploy your updated configuration, run',
          {
            command: formatPackageManagerCommand(app.packageManager, 'shopify app deploy'),
          },
        ],
      ],
    })

    return {app}
  }
}

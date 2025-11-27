import {appFlags} from '../../../flags.js'
import {localAppContext} from '../../../services/app-context.js'
import pull from '../../../services/app/config/pull.js'
import AppUnlinkedCommand, {AppUnlinkedCommandOutput} from '../../../utilities/app-unlinked-command.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigPull extends AppUnlinkedCommand {
  static summary = 'Refresh an already-linked app configuration without prompts.'

  static descriptionWithMarkdown = `Pulls the latest configuration from the already-linked Shopify app and updates the selected configuration file.

This command reuses the existing linked app and organization and skips all interactive prompts. Use \`--config\` to target a specific configuration file, or omit it to use the default one.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppUnlinkedCommandOutput> {
    const {flags} = await this.parse(ConfigPull)

    // Run the pull service (no prompts)
    const {configuration, remoteApp} = await pull({
      directory: flags.path,
      configName: flags.config,
    })

    // Get local app context so the return type matches other commands
    const app = await localAppContext({
      directory: flags.path,
      userProvidedConfigName: flags.config,
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

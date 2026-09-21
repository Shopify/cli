import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import pull from '../../../services/app/config/pull.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {appConfigPullJsonOutputSchema} from '../../../services/app/config/pull/types.js'
import {renderAppConfigPullResult} from '../../../services/app/config/pull/result.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class ConfigPull extends AppLinkedCommand {
  static summary = 'Refresh an already-linked app configuration without prompts.'

  static descriptionWithMarkdown = `Pulls the latest configuration from the already-linked Shopify app and updates the selected configuration file.

This command reuses the existing linked app and organization and skips all interactive prompts. Use \`--config\` to target a specific configuration file, or omit it to use the default one.`

  static get jsonOutputSchema() {
    return appConfigPullJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
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

    const result = await pull({
      directory: flags.path,
      configName: flags.config,
      configPath: app.configPath,
      configuration: app.configuration,
      remoteApp,
    })

    renderAppConfigPullResult(result, flags.json ? 'json' : 'text')

    return {app}
  }
}

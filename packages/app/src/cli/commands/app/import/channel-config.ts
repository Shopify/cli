import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {importChannelConfig} from '../../../services/import-channel-config/import.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {importChannelConfigJsonOutputSchema} from '../../../services/import-channel-config/types.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class ImportChannelConfig extends AppLinkedCommand {
  // Only available to allowlisted channel partners for now
  static hidden = true

  static summary = "Import your app's default channel spec as a channel_config extension."

  static descriptionWithMarkdown = `Imports the Shopify-authored channel spec for your app as a \`channel_config\` extension.

  The generated TOML only includes public \`channel_config\` fields. Review it, then deploy it with \`shopify app deploy\`.`

  static description = this.descriptionWithoutMarkdown()

  static get jsonOutputSchema() {
    return importChannelConfigJsonOutputSchema
  }

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    force: Flags.boolean({
      description: 'Overwrite the existing channel spec file without prompting.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ImportChannelConfig)

    const {app, remoteApp, developerPlatformClient} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await importChannelConfig({
      app,
      remoteApp,
      developerPlatformClient,
      force: flags.force,
      json: flags.json,
    })

    return {app}
  }
}

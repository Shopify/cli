import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {importChannelConfig} from '../../../services/import-channel-config/import.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ImportChannelConfig extends AppLinkedCommand {
  static summary = 'Import the Shopify-authored default channel spec as a channel_config TOML file.'

  static descriptionWithMarkdown = `Imports the Shopify-authored default channel specification for your app as a deployable \`channel_config\` extension spec.

  The generated TOML file contains only public \`channel_config\` fields. Review it, commit it to your app, then deploy it with \`shopify app deploy\`. This command never deploys the spec itself.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    stdout: Flags.boolean({
      description: 'Print the generated TOML to stdout instead of writing it to a file.',
      env: 'SHOPIFY_FLAG_STDOUT',
      default: false,
    }),
    overwrite: Flags.boolean({
      description: 'Overwrite the existing channel spec file if one already exists.',
      env: 'SHOPIFY_FLAG_OVERWRITE',
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
      stdout: flags.stdout,
      overwrite: flags.overwrite,
    })

    return {app}
  }
}

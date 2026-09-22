import {appFlags} from '../../../flags.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {importChannelConfig} from '../../../services/import-channel-config/import.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {importChannelConfigJsonOutputSchema} from '../../../services/import-channel-config/types.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class ImportChannelConfig extends AppLinkedCommand {
  // Prototype scoped to an allowlisted cohort of channel partners; the backend fails closed for
  // everyone else, so keep the command out of public help/docs until the rollout widens.
  static hidden = true

  static summary = 'Import the Shopify-authored default channel spec as a channel_config TOML file.'

  static descriptionWithMarkdown = `Imports the Shopify-authored default channel specification for your app as a deployable \`channel_config\` extension spec.

  The generated TOML file contains only public \`channel_config\` fields. Review it, commit it to your app, then deploy it with \`shopify app deploy\`. This command never deploys the spec itself.`

  static description = this.descriptionWithoutMarkdown()

  static get jsonOutputSchema() {
    return importChannelConfigJsonOutputSchema
  }

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    stdout: Flags.boolean({
      description:
        'Print the generated TOML to stdout instead of writing it to a file. For piped output, use an already-linked app: first-time linking prompts may interleave with the output.',
      env: 'SHOPIFY_FLAG_STDOUT',
      default: false,
      exclusive: ['json'],
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
      json: flags.json,
    })

    return {app}
  }
}

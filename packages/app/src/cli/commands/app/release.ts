import {appFlags} from '../../flags.js'
import {release} from '../../services/release.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {getAppConfigurationState} from '../../models/app/loader.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Release extends AppLinkedCommand {
  static summary = 'Release an app version.'

  static usage = `app release --version <version>`

  static descriptionWithMarkdown = `Releases an existing app version. Pass the name of the version that you want to release using the \`--version\` flag.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    force: Flags.boolean({
      hidden: false,
      description: 'Release without asking for confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
    }),
    version: Flags.string({
      hidden: false,
      description: 'The name of the app version to release.',
      env: 'SHOPIFY_FLAG_VERSION',
      required: true,
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Release)
    const clientId = flags['client-id']

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const requiredNonTTYFlags = ['force']
    const configurationState = await getAppConfigurationState(flags.path, flags.config)
    if (configurationState.state === 'template-only' && !clientId) {
      requiredNonTTYFlags.push('client-id')
    }
    this.failMissingNonTTYFlags(flags, requiredNonTTYFlags)

    const {app, remoteApp, developerPlatformClient} = await linkedAppContext({
      directory: flags.path,
      clientId,
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await release({
      app,
      remoteApp,
      developerPlatformClient,
      force: flags.force,
      version: flags.version,
    })

    return {app}
  }
}

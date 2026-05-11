import {appFlags} from '../../flags.js'
import {release} from '../../services/release.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
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
    'allow-updates': Flags.boolean({
      hidden: false,
      description:
        'Allows adding and updating extensions and configuration without requiring user confirmation. Recommended option for CI/CD environments.',
      env: 'SHOPIFY_FLAG_ALLOW_UPDATES',
    }),
    'allow-deletes': Flags.boolean({
      hidden: false,
      description:
        'Allows removing extensions and configuration without requiring user confirmation. For CI/CD environments, the recommended flag is --allow-updates.',
      env: 'SHOPIFY_FLAG_ALLOW_DELETES',
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

    const allowUpdates = flags['allow-updates']
    const allowDeletes = flags['allow-deletes']
    // `force` (skip confirmation prompt) is implied when both --allow-updates
    // and --allow-deletes are set.
    const force = Boolean(allowUpdates && allowDeletes)

    // We require --allow-updates or --allow-deletes for non-TTY.
    const requiredNonTTYFlags: string[] = []
    if (!allowUpdates && !allowDeletes) {
      requiredNonTTYFlags.push('allow-updates')
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
      force,
      allowUpdates,
      allowDeletes,
      version: flags.version,
    })

    return {app}
  }
}

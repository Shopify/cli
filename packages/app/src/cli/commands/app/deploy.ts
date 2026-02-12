import {appFlags} from '../../flags.js'
import {deploy} from '../../services/deploy.js'
import {validateVersion} from '../../validations/version-name.js'
import {validateMessage} from '../../validations/message.js'
import metadata from '../../metadata.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/shared/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/shared/node/metadata'

export default class Deploy extends AppLinkedCommand {
  static summary = 'Deploy your Shopify app.'

  static descriptionWithMarkdown = `[Builds the app](https://shopify.dev/docs/api/shopify-cli/app/app-build), then deploys your app configuration and extensions.

  This command creates an app version, which is a snapshot of your app configuration and all extensions. This version is then released to users.

  This command doesn't deploy your [web app](https://shopify.dev/docs/apps/tools/cli/structure#web-components). You need to [deploy your web app](https://shopify.dev/docs/apps/deployment/web) to your own hosting solution.
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    force: Flags.boolean({
      hidden: false,
      description:
        'Deploy without asking for confirmation. Equivalent to --allow-updates --allow-deletes. For CI/CD environments, the recommended flag is --allow-updates.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
    }),
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
    'no-release': Flags.boolean({
      hidden: false,
      description:
        "Creates a version but doesn't release it - it's not made available to merchants. With this flag, a user confirmation is not required.",
      env: 'SHOPIFY_FLAG_NO_RELEASE',
      default: false,
      exclusive: ['allow-updates', 'allow-deletes'],
    }),
    'no-build': Flags.boolean({
      description:
        'Use with caution: Skips building any elements of the app that require building. You should ensure your app has been prepared in advance, such as by running `shopify app build` or by caching build artifacts.',
      env: 'SHOPIFY_FLAG_NO_BUILD',
      default: false,
    }),
    message: Flags.string({
      hidden: false,
      description:
        "Optional message that will be associated with this version. This is for internal use only and won't be available externally.",
      env: 'SHOPIFY_FLAG_MESSAGE',
    }),
    version: Flags.string({
      hidden: false,
      description:
        'Optional version tag that will be associated with this app version. If not provided, an auto-generated identifier will be generated for this app version.',
      env: 'SHOPIFY_FLAG_VERSION',
    }),
    'source-control-url': Flags.string({
      hidden: false,
      description: 'URL associated with the new app version.',
      env: 'SHOPIFY_FLAG_SOURCE_CONTROL_URL',
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Deploy)

    await metadata.addPublicMetadata(() => ({
      cmd_deploy_flag_message_used: Boolean(flags.message),
      cmd_deploy_flag_version_used: Boolean(flags.version),
      cmd_deploy_flag_source_url_used: Boolean(flags['source-control-url']),
    }))

    validateVersion(flags.version)
    validateMessage(flags.message)

    const clientId = flags['client-id']

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const force = flags.force || flags['no-release']

    // When releasing, we require --force or --allow-updates or --allow-deletes for non-TTY.
    const requiredNonTTYFlags: string[] = []
    const hasAnyForceFlags = force || flags['allow-updates'] || flags['allow-deletes']
    if (!hasAnyForceFlags) {
      requiredNonTTYFlags.push('allow-updates')
    }
    this.failMissingNonTTYFlags(flags, requiredNonTTYFlags)

    const {app, remoteApp, developerPlatformClient, organization} = await linkedAppContext({
      directory: flags.path,
      clientId,
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const allowUpdates = force || flags['allow-updates']
    const allowDeletes = force || flags['allow-deletes']

    const result = await deploy({
      app,
      remoteApp,
      organization,
      developerPlatformClient,
      reset: flags.reset,
      force,
      allowUpdates,
      allowDeletes,
      noRelease: flags['no-release'],
      message: flags.message,
      version: flags.version,
      commitReference: flags['source-control-url'],
      skipBuild: flags['no-build'],
    })

    return {app: result.app}
  }
}

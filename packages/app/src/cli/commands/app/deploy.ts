import {appFlags} from '../../flags.js'
import {deploy} from '../../services/deploy.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import {validateVersion} from '../../validations/version-name.js'
import Command from '../../utilities/app-command.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {validateMessage} from '../../validations/message.js'
import metadata from '../../metadata.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Deploy extends Command {
  static description = 'Deploy your Shopify app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
      exclusive: ['config'],
    }),
    force: Flags.boolean({
      hidden: false,
      description: 'Deploy without asking for confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
    }),
    'no-release': Flags.boolean({
      hidden: false,
      description: "Creates a version but doesn't release it - it's not made available to merchants.",
      env: 'SHOPIFY_FLAG_NO_RELEASE',
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

  async run(): Promise<void> {
    const {flags} = await this.parse(Deploy)

    await metadata.addPublicMetadata(() => ({
      cmd_deploy_flag_message_used: Boolean(flags.message),
      cmd_deploy_flag_version_used: Boolean(flags.version),
      cmd_deploy_flag_source_url_used: Boolean(flags['source-control-url']),
    }))

    validateVersion(flags.version)
    validateMessage(flags.message)

    if (!flags['api-key']) {
      if (process.env.SHOPIFY_API_KEY) {
        flags['api-key'] = process.env.SHOPIFY_API_KEY
      }
    }
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const app: AppInterface = await loadApp({directory: flags.path, configName: flags.config})

    const requiredNonTTYFlags = ['force']
    if (!apiKey && !app.configuration.client_id) requiredNonTTYFlags.push('client-id')
    this.failMissingNonTTYFlags(flags, requiredNonTTYFlags)

    await deploy({
      app,
      apiKey,
      reset: flags.reset,
      force: flags.force,
      noRelease: flags['no-release'],
      message: flags.message,
      version: flags.version,
      commitReference: flags['source-control-url'],
    })
  }
}

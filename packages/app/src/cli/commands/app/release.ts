import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import {release} from '../../services/release.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Release extends AppCommand {
  static summary = 'Release an app version.'

  static usage = `app:release --version <version>`

  static descriptionWithMarkdown = `Releases an existing app version. Pass the name of the version that you want to release using the \`--version\` flag.`

  static description = this.descriptionWithoutMarkdown()

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
    }),
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

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Release)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await addPublicMetadata(() => ({
      cmd_app_reset_used: flags.reset,
    }))

    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })

    const requiredNonTTYFlags = ['force']
    if (!apiKey && !app.configuration.client_id) requiredNonTTYFlags.push('client-id')
    this.failMissingNonTTYFlags(flags, requiredNonTTYFlags)

    await release({
      app,
      apiKey,
      reset: flags.reset,
      force: flags.force,
      version: flags.version,
    })

    return {app}
  }
}

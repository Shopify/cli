import Command from '../../utilities/app-command.js'
import updateURL, {UpdateURLOptions} from '../../services/app/update-url.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {appFlags} from '../../flags.js'
import {loadAppConfiguration} from '../../models/app/loader.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class UpdateURL extends Command {
  static summary = 'Update your app and redirect URLs in the Partners Dashboard.'

  static description = `Updates the app URL and allowed redirection URLs for your app. When you specify URLs using this command, the current URLs are overwritten.

  Your current app URLs are provided as placeholder responses. To keep either your app URL or redirect URLs the same, submit the placeholder content. Alternatively, use the \`--app-url\` or \`--redirect-urls\` flag to update only one of these settings.`

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
    'app-url': Flags.string({
      hidden: false,
      description: 'URL through which merchants will access your app.',
      env: 'SHOPIFY_FLAG_APP_URL',
    }),
    'redirect-urls': Flags.string({
      hidden: false,
      description: 'Comma separated list of allowed URLs where merchants are redirected after the app is installed',
      env: 'SHOPIFY_FLAG_REDIRECT_URLS',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(UpdateURL)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    const app = await loadAppConfiguration({
      configName: flags.config,
      directory: flags.path,
    })

    const options: UpdateURLOptions = {
      apiKey,
      appURL: flags['app-url'],
      redirectURLs: flags['redirect-urls']?.split(','),
      app,
    }
    await updateURL(options)
  }
}

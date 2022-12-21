import Command from '../../utilities/app-command.js'
import updateURL from '../../services/app/update-url.js'
import {Flags} from '@oclif/core'
import {cli} from '@shopify/cli-kit'

export default class UpdateURL extends Command {
  static description = 'Update your app and redirect URLs in the Partners Dashboard'

  static flags = {
    ...cli.globalFlags,
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    'app-url': Flags.string({
      hidden: false,
      description: 'App URL.',
      env: 'SHOPIFY_FLAG_APP_URL',
    }),
    'redirect-urls': Flags.string({
      hidden: false,
      description: 'Comma separated list of allowed redirection URLs.',
      env: 'SHOPIFY_FLAG_REDIRECT_URLS',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(UpdateURL)
    await updateURL(flags['api-key'], flags['app-url'], flags['redirect-urls']?.split(','))
  }
}

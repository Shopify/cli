import {init} from '../../services/init.js'
import {hydrogenFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {cli, path} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'

export default class Build extends Command {
  static description = 'Allows the quick initialisation of a Hydrogen storefront config file.'
  static flags = {
    ...cli.globalFlags,
    ...hydrogenFlags,
    country: Flags.string({
      description: 'The default country code.',
      env: 'SHOPIFY_FLAG_COUNTRY_CODE',
      default: 'US',
    }),
    lang: Flags.string({
      description: 'The default language code.',
      env: 'SHOPIFY_FLAG_LANG_CODE',
      default: 'EN',
    }),
    domain: Flags.string({
      description: 'The Shopify storefront domain.',
      env: 'SHOPIFY_FLAG_DOMAIN',
      default: 'hydrogen-preview.myshopify.com',
    }),
    token: Flags.string({
      description: 'The Shopify storefront token.',
      env: 'SHOPIFY_FLAG_TOKEN',
      default: '3b580e70970c4528da70c98e097c2fa0',
    }),
    apiVersion: Flags.string({
      description: 'The Shopify storefront API version.',
      env: 'SHOPIFY_FLAG_API_VERSION',
      default: '2022-07',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    await init({directory, ...flags})
  }
}

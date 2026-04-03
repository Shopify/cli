import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'
import {showStoreAuthInfo} from '../../../services/store/auth-info.js'

export default class StoreAuthInfo extends Command {
  static summary = 'Show locally stored store auth information for a store.'

  static descriptionWithMarkdown = `Shows the locally stored store auth information for the specified store, including scopes, associated user, and token status.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store to inspect.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuthInfo)

    showStoreAuthInfo(flags.store, flags.json ? 'json' : 'text')
  }
}

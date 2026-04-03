import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'
import {displayStoreAuthLogout, logoutStoreAuth} from '../../../services/store/auth-logout.js'

export default class StoreAuthLogout extends Command {
  static summary = 'Clear locally stored store auth for a store.'

  static descriptionWithMarkdown = `Clears the locally stored store auth for the specified store on this machine.

This does not revoke the app or remove granted scopes on Shopify.`

  static description = this.descriptionWithoutMarkdown()

  static examples = ['<%= config.bin %> <%= command.id %> --store shop.myshopify.com']

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store to clear local auth for.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuthLogout)

    const result = logoutStoreAuth(flags.store)
    displayStoreAuthLogout(result)
  }
}

import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'

export default class StoreAuth extends Command {
  static summary = 'Authenticate an app against a store for store commands.'

  static descriptionWithMarkdown = `Authenticates the app against the specified store for store commands and stores an online access token for later reuse.

Re-run this command if the stored token is missing, expires, or no longer has the scopes you need.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store to authenticate against.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
    scopes: Flags.string({
      description: 'Comma-separated Admin API scopes to request for the app.',
      env: 'SHOPIFY_FLAG_SCOPES',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuth)

    await authenticateStoreWithApp(
      {
        store: flags.store,
        scopes: flags.scopes,
      },
      {
        presenter: createStoreAuthPresenter(flags.json ? 'json' : 'text'),
      },
    )
  }
}

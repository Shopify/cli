import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'
import {authenticateStoreWithApp} from '../../services/store/auth.js'
import {DEFAULT_STORE_AUTH_PORT} from '../../services/store/config.js'

export default class StoreAuth extends Command {
  static summary = 'Authenticate an app against a store for store commands.'

  static descriptionWithMarkdown = `Starts a PKCE OAuth flow against the specified store and stores an online access token for later use by \`shopify store execute\`.

This flow authenticates the app on behalf of the current user. Re-run this command if the stored token is missing, expires, or no longer has the scopes you need.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products',
  ]

  static flags = {
    ...globalFlags,
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
    port: Flags.integer({
      description: 'Local port to use for the OAuth callback server.',
      env: 'SHOPIFY_FLAG_PORT',
      default: DEFAULT_STORE_AUTH_PORT,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuth)

    await authenticateStoreWithApp({
      store: flags.store,
      scopes: flags.scopes,
      port: flags.port,
    })
  }
}

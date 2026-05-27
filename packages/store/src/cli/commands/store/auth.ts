import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {Flags} from '@oclif/core'

export default class StoreAuth extends StoreCommand {
  static summary = 'Authenticate an app against a store for store commands.'

  static descriptionWithMarkdown = `Authenticates the app against the specified store for store commands and stores an online access token for later reuse.

Re-run this command if the stored token is missing, expires, or no longer has the scopes you need.

In an interactive terminal, Shopify CLI opens or prints the authorization URL and waits for authentication to complete. Agents should keep the command running until the browser authorization finishes.

In a non-TTY environment, Shopify CLI returns the current session if it already has the requested scopes. If no usable session exists, it starts the same OAuth flow and waits for authentication to complete.`

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
    }),
    scopes: Flags.string({
      description: 'Comma-separated Admin API scopes to request for the app.',
      env: 'SHOPIFY_FLAG_SCOPES',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreAuth)
    const presenter = createStoreAuthPresenter(flags.json ? 'json' : 'text')

    if (!flags.store || !flags.scopes) {
      throw new AbortError('Missing required flags.', 'Pass --store and --scopes.')
    }

    await authenticateStoreWithApp(
      {
        store: flags.store,
        scopes: flags.scopes,
      },
      {
        presenter,
      },
    )
  }
}

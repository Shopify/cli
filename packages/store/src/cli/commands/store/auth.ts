import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreAuth extends StoreCommand {
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
    store: storeFlags.store,
    scopes: Flags.string({
      description: 'Comma-separated Admin API scopes to request for the app.',
      env: 'SHOPIFY_FLAG_SCOPES',
      required: true,
    }),
  }

  public async run(): Promise<void> {
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

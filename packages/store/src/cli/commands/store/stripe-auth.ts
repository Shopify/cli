import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {storeFlags} from '../../flags.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreStripeAuth extends StoreCommand {
  static hidden = true

  static summary = 'Authenticate for store commands.'

  static descriptionWithMarkdown = `Authenticates to a store then stores an online access token for later reuse. Pass the provided JWT to --signup.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --signup <signup-jwt>',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --scopes read_products,write_products --signup <signup-jwt> --json',
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
    signup: Flags.string({
      description: 'Provide JWT for the store.',
      env: 'SHOPIFY_FLAG_SIGNUP',
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreStripeAuth)

    await authenticateStoreWithApp(
      {
        store: flags.store,
        scopes: flags.scopes,
        signup: flags.signup,
      },
      {
        presenter: createStoreAuthPresenter(flags.json ? 'json' : 'text'),
      },
    )
  }
}

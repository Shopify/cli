import {appFlags} from '../../flags'
import {load as loadApp, App} from '../../models/app/app'
import dev from '../../services/dev'
import {Command, Flags} from '@oclif/core'
import {path, string, cli, error} from '@shopify/cli-kit'

export default class Dev extends Command {
  static description = 'Run the app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Development store URL. Must be an existing development store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'no-update': Flags.boolean({
      hidden: false,
      description: 'Skips the dashboard URL update step.',
      env: 'SHOPIFY_FLAG_NO_UPDATE',
      default: false,
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'subscription-product-url': Flags.string({
      hidden: false,
      description: 'Resource URL for subscription UI extension. Format: "/products/{productId}"',
      env: 'SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'checkout-cart-url': Flags.string({
      hidden: false,
      description: 'Resource URL for checkeout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"',
      env: 'SHOPIFY_FLAG_CHECKOUT_CART_URL',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    const commandConfig = this.config

    try {
      await dev({
        app,
        apiKey: flags['api-key'],
        storeFqdn: flags.store,
        reset: flags.reset,
        update: !flags['no-update'],
        skipDependenciesInstallation: flags['skip-dependencies-installation'],
        commandConfig,
        subscriptionProductUrl: flags['subscription-product-url'],
        checkoutCartUrl: flags['checkout-cart-url'],
      })
    } catch (err) {
      if (!(err instanceof error.CancelExecution)) {
        throw err
      }
    }
  }
}

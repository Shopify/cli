import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import dev from '../../services/dev.js'
import {load as loadApp} from '../../models/app/loader.js'
import Command from '../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {path, string, cli, metadata} from '@shopify/cli-kit'

export default class Dev extends Command {
  static description = 'Run the app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
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
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    'no-update': Flags.boolean({
      hidden: false,
      description: 'Skips the Partners Dashboard URL update step.',
      env: 'SHOPIFY_FLAG_NO_UPDATE',
      default: false,
    }),
    'subscription-product-url': Flags.string({
      hidden: false,
      description: 'Resource URL for subscription UI extension. Format: "/products/{productId}"',
      env: 'SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL',
    }),
    'checkout-cart-url': Flags.string({
      hidden: false,
      description: 'Resource URL for checkeout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"',
      env: 'SHOPIFY_FLAG_CHECKOUT_CART_URL',
    }),
    'tunnel-url': Flags.string({
      hidden: false,
      description: 'Override the ngrok tunnel URL. Format: "https://my-tunnel-url:port"',
      env: 'SHOPIFY_FLAG_TUNNEL_URL',
      exclusive: ['no-tunnel', 'tunnel'],
    }),
    'no-tunnel': Flags.boolean({
      hidden: true,
      description: 'Automatic creation of a tunnel is disabled. Service entry point will listen to localhost instead',
      env: 'SHOPIFY_FLAG_NO_TUNNEL',
      default: false,
      exclusive: ['tunnel-url', 'tunnel'],
    }),
    tunnel: Flags.boolean({
      hidden: false,
      description: 'Use ngrok to create a tunnel to your service entry point',
      env: 'SHOPIFY_FLAG_TUNNEL',
      default: true,
      exclusive: ['tunnel-url', 'no-tunnel'],
    }),
    theme: Flags.string({
      hidden: false,
      char: 't',
      description: 'Theme ID or name of the theme app extension host theme.',
      env: 'SHOPIFY_FLAG_THEME',
    }),
    'theme-app-extension-port': Flags.integer({
      hidden: false,
      description: 'Local port of the theme app extension development server.',
      env: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Dev)

    await metadata.addPublic(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
      cmd_app_reset_used: flags.reset,
    }))

    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: AppInterface = await loadApp(directory)
    const commandConfig = this.config

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
      tunnelUrl: flags['tunnel-url'],
      tunnel: flags.tunnel,
      noTunnel: flags['no-tunnel'],
      theme: flags.theme,
      themeExtensionPort: flags['theme-app-extension-port'],
    })
  }
}

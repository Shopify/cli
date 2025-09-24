import {appFlags} from '../../flags.js'
import {dev, DevOptions} from '../../services/dev.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {getTunnelMode} from '../../services/dev/tunnel-mode.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Dev extends AppLinkedCommand {
  static summary = 'Run the app.'

  static descriptionWithMarkdown = `Builds and previews your app on a development store, and watches for changes. [Read more about testing apps locally](https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'skip-dependencies-installation': Flags.boolean({
      description: 'Skips the installation of dependencies. Deprecated, use workspaces instead.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    'no-update': Flags.boolean({
      description: 'Skips the Partners Dashboard URL update step.',
      env: 'SHOPIFY_FLAG_NO_UPDATE',
      default: false,
    }),
    'subscription-product-url': Flags.string({
      description: 'Resource URL for subscription UI extension. Format: "/products/{productId}"',
      env: 'SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL',
    }),
    'checkout-cart-url': Flags.string({
      description: 'Resource URL for checkout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"',
      env: 'SHOPIFY_FLAG_CHECKOUT_CART_URL',
    }),
    'tunnel-url': Flags.string({
      description:
        'Use a custom tunnel, it must be running before executing dev. Format: "https://my-tunnel-url:port".',
      env: 'SHOPIFY_FLAG_TUNNEL_URL',
      exclusive: ['tunnel'],
    }),
    'use-localhost': Flags.boolean({
      description:
        "Service entry point will listen to localhost. A tunnel won't be used. Will work for testing many app features, but not those that directly invoke your app (E.g: Webhooks)",
      env: 'SHOPIFY_FLAG_USE_LOCALHOST',
      default: false,
      exclusive: ['tunnel-url'],
    }),
    'localhost-port': Flags.integer({
      description: 'Port to use for localhost.',
      env: 'SHOPIFY_FLAG_LOCALHOST_PORT',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the theme app extension host theme.',
      env: 'SHOPIFY_FLAG_THEME',
    }),
    'theme-app-extension-port': Flags.integer({
      description: 'Local port of the theme app extension development server.',
      env: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT',
    }),
    notify: Flags.string({
      description:
        'The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a webhook posted to report on file changes.',
      env: 'SHOPIFY_FLAG_NOTIFY',
    }),
    'graphiql-port': Flags.integer({
      hidden: true,
      description: 'Local port of the GraphiQL development server.',
      env: 'SHOPIFY_FLAG_GRAPHIQL_PORT',
    }),
    'graphiql-key': Flags.string({
      hidden: true,
      description:
        'Key used to authenticate GraphiQL requests. Should be specified if exposing GraphiQL on a publicly accessible URL. By default, no key is required.',
      env: 'SHOPIFY_FLAG_GRAPHIQL_KEY',
    }),
  }

  public static analyticsStopCommand(): string | undefined {
    return 'app dev stop'
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Dev)

    if (!flags['api-key'] && process.env.SHOPIFY_API_KEY) {
      flags['api-key'] = process.env.SHOPIFY_API_KEY
    }
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const tunnelMode = await getTunnelMode({
      useLocalhost: flags['use-localhost'],
      tunnelUrl: flags['tunnel-url'],
      localhostPort: flags['localhost-port'],
    })

    await addPublicMetadata(() => {
      return {
        cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
        cmd_app_reset_used: flags.reset,
        cmd_dev_tunnel_type: tunnelMode.mode,
      }
    })

    await checkFolderIsValidApp(flags.path)

    const appContextResult = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })
    const store = await storeContext({
      appContextResult,
      storeFqdn: flags.store,
      forceReselectStore: flags.reset,
    })

    const devOptions: DevOptions = {
      ...appContextResult,
      store,
      directory: flags.path,
      update: !flags['no-update'],
      skipDependenciesInstallation: flags['skip-dependencies-installation'],
      commandConfig: this.config,
      subscriptionProductUrl: flags['subscription-product-url'],
      checkoutCartUrl: flags['checkout-cart-url'],
      theme: flags.theme,
      themeExtensionPort: flags['theme-app-extension-port'],
      notify: flags.notify,
      graphiqlPort: flags['graphiql-port'],
      graphiqlKey: flags['graphiql-key'],
      tunnel: tunnelMode,
    }

    await dev(devOptions)
    return {app: appContextResult.app}
  }
}

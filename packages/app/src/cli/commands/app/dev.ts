import {appFlags} from '../../flags.js'
import {dev, DevOptions, TunnelMode} from '../../services/dev.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {generateCertificate} from '../../utilities/mkcert.js'
import {generateCertificatePrompt} from '../../prompts/dev.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Dev extends AppCommand {
  static summary = 'Run the app.'

  static descriptionWithMarkdown = `[Builds the app](https://shopify.dev/docs/api/shopify-cli/app/app-build) and lets you preview it on a [development store](https://shopify.dev/docs/apps/tools/development-stores) or [Plus sandbox store](https://help.shopify.com/partners/dashboard/managing-stores/plus-sandbox-store).

> Note: Development store preview of extension drafts is not supported for Plus sandbox stores. You must \`deploy\` your app.

  To preview your app on a development store or Plus sandbox store, Shopify CLI walks you through the following steps. If you've run \`dev\` before, then your settings are saved and some of these steps are skipped. You can reset these configurations using \`dev --reset\` to go through all of them again:

- Associating your project with an app associated with your Partner account or organization, or creating a new app.
- Selecting a development store or Plus sandbox store to use for testing. If you have only one store, then it's selected automatically.
- Installing your app on the store using the provided install link.
- Creating a tunnel between your local environment and the store using Cloudflare.

  You can use your own tunneling software instead, by passing your tunnel URL with the \`--tunnel-url\` flag.
- Updating the app URLs that are set in the Partner Dashboard.

  To avoid overwriting any URLs that are already set, select the No, never option. If you select this option, then you're provided with URLs that you can manually add in the Partner Dashboard so you can preview your app.

- Enabling development store preview for extensions.
- Serving [GraphiQL for the Admin API](https://shopify.dev/docs/apps/tools/graphiql-admin-api#use-a-local-graphiql-instance) using your app's credentials and access scopes.
- Building and serving your app and app extensions.

If you're using the Ruby app template, then you need to complete the following steps outlined in the [README](https://github.com/Shopify/shopify-app-template-ruby#setting-up-your-rails-app) before you can preview your app for the first time.

> Caution: To use a development store or Plus sandbox store with Shopify CLI, you need to be the store owner, or have a [staff account](https://help.shopify.com/manual/your-account/staff-accounts) on the store. Staff accounts are created automatically the first time you access a development store with your Partner staff account through the Partner Dashboard.
`

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
      hidden: false,
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies. Deprecated, use workspaces instead.',
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
      description: 'Resource URL for checkout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"',
      env: 'SHOPIFY_FLAG_CHECKOUT_CART_URL',
    }),
    'tunnel-url': Flags.string({
      hidden: false,
      description:
        'Use a custom tunnel, it must be running before executing dev. Format: "https://my-tunnel-url:port".',
      env: 'SHOPIFY_FLAG_TUNNEL_URL',
      exclusive: ['tunnel'],
    }),
    'use-localhost': Flags.boolean({
      hidden: true,
      description:
        "Service entry point will listen to localhost. A tunnel won't be used. Will work for testing many app features, but not Webhooks, Flow Action, App Proxy or POS",
      env: 'SHOPIFY_FLAG_USE_LOCALHOST',
      default: false,
      exclusive: ['tunnel-url'],
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

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Dev)

    if (!flags['api-key'] && process.env.SHOPIFY_API_KEY) {
      flags['api-key'] = process.env.SHOPIFY_API_KEY
    }
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    let tunnel: TunnelMode = {mode: 'auto'}
    let tunnelType = 'cloudflare'

    if (flags['use-localhost']) {
      tunnelType = 'use-localhost'
      tunnel = {
        mode: 'no-tunnel-use-localhost',
        provideCertificate: async (appDirectory) => {
          renderInfo({
            headline: 'Localhost-based development is in developer preview.',
            body: [
              '`--use-localhost` is not compatible with Shopify features which directly invoke your app',
              '(such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another',
              'device (such as POS). Please report any issues and provide feedback on the dev community:',
            ],
            link: {
              label: 'Create a feedback post',
              url: 'https://community.shopify.dev/new-topic?category=shopify-cli-libraries&tags=app-dev-on-localhost',
            },
          })

          return generateCertificate({
            appDirectory,
            onRequiresConfirmation: generateCertificatePrompt,
          })
        },
      }
    } else if (flags['tunnel-url']) {
      tunnelType = 'custom'
      tunnel = {
        mode: 'provided',
        url: flags['tunnel-url'],
      }
    }

    await addPublicMetadata(() => {
      return {
        cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
        cmd_app_reset_used: flags.reset,
        cmd_dev_tunnel_type: tunnelType,
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
      tunnel,
    }

    await dev(devOptions)
    return {app: appContextResult.app}
  }
}

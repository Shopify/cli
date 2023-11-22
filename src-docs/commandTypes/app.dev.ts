export interface appDev {
  /**
   * The URL of a tunnel that you've started using your own local tunneling software. Shopify recommends [Cloudflare tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/run-tunnel/trycloudflare/) for use with Shopify CLI.
   *
   * Expected format: `https://my-tunnel-url:port`
   */
  '--tunnel-url'?: string

  /**
   * The development store or Plus sandbox store that you want to use to preview your app.
   *
   * The `--store` (or `-s`) flag accepts the following inputs:
   *
   *  - The store prefix (johns-apparel)
   *  - The [myshopify.com URL](https://help.shopify.com/manual/domains?shpxid=f75d4b9f-3CE2-4156-F28E-0364F1AF6ABB) (`johns-apparel.myshopify.com`, `https://johns-apparel.myshopify.com`)
   */
  '--store <store>'?: string

  /**
   * The name of the config to use.
   */
  '--config <config-name>'?: string

  /**
   *The client ID of your app. Use this flag to specify the app that you want to connect your project with. This flag replaces the deprecated `--api-key` flag.
   */
  '--client-id <id>'?: string

  /**
   * Skip the prompt to update the app URLs that are set in the Partner Dashboard. Your URLs won't be updated.
   */
  '--no-update'?: ''

  /**
   * The path to your app directory.
   *
   * @default current working directory
   */
  '--path <path/to/your/project>'?: string

  /**
   * Skip checking and installing missing dependencies for your app.
   */
  '--skip-dependencies-installation'?: ''

  /**
   * Reset all of your `dev` settings and send an uninstall request for the store to the default webhook endpoint (`/api/webhooks`), or the endpoint defined in [shopify.web.toml](/docs/apps/tools/cli/structure#shopify-web-toml).
   */
  '--reset'?: ''

  /**
   * Provide more detailed output in the logs.
   */
  '--verbose'?: ''

  /**
   * Disables color output in the logs
   */
  '--no-color'?: ''

  /**
   * A partial link with a [product variant ID](https://help.shopify.com/manual/products/variants/find-variant-id?shpxid=f75d4b9f-3CE2-4156-F28E-0364F1AF6ABB) and quantity to be used to create a test checkout for [checkout UI extensions](/docs/apps/checkout/build-options). If the flag isn't passed, then Shopify CLI auto-populates this value. To test with a specific product variant ID and quantity, you can provide the flag as `--checkout-cart-url "/cart/12345:1"`, where `12345` is the product variant ID and `:1` is the quantity.
   */
  '--checkout-cart-url <url>'?: string

  /**
   * A partial link with a product ID. Use this flag to specify the product to use when testing a purchase option extension. If the flag isn't passed, then Shopify CLI auto-populates this value. To test with a specific product ID, you can provide the flag as `--subscription-product-url "/products/12345"`, where `12345` is the product ID.
   */
  '--subscription-product-url <url>'?: string

  /**
   * 	The local port to be used to test a [theme app extension](/docs/apps/online-store/theme-app-extensions).
   */
  '--theme-app-extension-port <port>'?: string

  /**
   * The ID or name of the theme to be used to test a [theme app extension](/docs/apps/online-store/theme-app-extensions).
   *
   * If no theme is specified, then the command will use [Dawn](https://github.com/Shopify/dawn), Shopify's example theme, when testing your theme app extension.
   */
  '--theme <theme id>'?: string
}

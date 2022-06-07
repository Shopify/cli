export interface ShopifyConfig {
  defaultLocale?: string
  storeDomain: string
  storefrontToken: string
  storefrontApiVersion: string
  multipassSecret?: string
}

export interface ServerAnalyticsConnector {
  request: (request: Request, data?: unknown, contentType?: 'json' | 'text') => void
}

export type HydrogenConfig = ClientConfig & {
  routes?: InlineHydrogenRoutes
  shopify?: ShopifyConfig
  serverAnalyticsConnectors?: ServerAnalyticsConnector[]
}

export interface ClientConfig {
  /** React's StrictMode is on by default for your client side app; if you want to turn it off (not recommended), you can pass `false` */
  strictMode?: boolean
  showDevTools?: boolean
}

export type InlineHydrogenRoutes =
  | string
  | {
      files: string
      basePath?: string
    }

import {WebhooksConfig} from './app_config_webhook.js'

/**
 * These are fields in the configuration object that the CLI itself uses during commands.
 *
 * You probably don't need to add or update this.
 *
 * This is a subset of the full app configuration object as provided or sent to the platform, and should remain the
 * case. Generally we don't want to bake in an assumption as to the shape of a particular module's configuration --
 * this is a platform concern. However, in some cases, the CLI does need to make choices based on the app config, and
 * having a well-typed structure makes that a bit easier to deal with.
 */
export interface AppConfigurationUsedByCli {
  name: string
  application_url: string
  embedded: boolean
  app_proxy?: {
    url: string
    prefix: string
    subpath: string
  }
  webhooks?: WebhooksConfig
  access_scopes?: {
    scopes?: string
    use_legacy_install_flow?: boolean
  }
  auth?: {
    redirect_urls: string[]
  }
  development?: {
    tunnel_url: string
    websocket_url: string
    dev_console_url: string
  }
}

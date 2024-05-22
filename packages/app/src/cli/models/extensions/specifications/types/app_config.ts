import {WebhooksConfig} from './app_config_webhook.js'

export interface SpecsAppConfiguration {
  name: string
  application_url: string
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
}

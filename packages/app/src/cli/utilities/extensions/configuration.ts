import {type AppConfiguration} from '../../models/app/app.js'
import {getPathValue} from '@shopify/cli-kit/common/object'

interface GetUIExensionResourceURLOptions {
  checkoutCartUrl?: string
  subscriptionProductUrl?: string
}

export function getUIExtensionResourceURL(
  uiExtensionType: string,
  options: GetUIExensionResourceURLOptions,
): {url: string | undefined} {
  switch (uiExtensionType) {
    case 'checkout_ui_extension':
      return {url: options.checkoutCartUrl}
    case 'product_subscription':
      return {url: options.subscriptionProductUrl ?? ''}
    default:
      return {url: ''}
  }
}

export class LocalAppConfiguration {
  private static instance: LocalAppConfiguration

  static getInstance(): LocalAppConfiguration {
    if (!LocalAppConfiguration.instance) {
      LocalAppConfiguration.instance = new LocalAppConfiguration()
    }
    return LocalAppConfiguration.instance
  }

  private config: AppConfiguration = {} as AppConfiguration

  private constructor() {}

  initializeConfig(initialConfig: AppConfiguration) {
    this.config = initialConfig
  }

  getFullConfig() {
    return this.config
  }

  getConfigValue<T = object>(path: string) {
    return getPathValue<T>(this.config, path)
  }
}

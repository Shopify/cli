import {getStoreInfo} from './info/index.js'
import {openURL as defaultOpenURL} from '@shopify/cli-kit/node/system'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import type {StoreInfoResult} from './info/types.js'

interface OpenStoreOptions {
  store: string
}

interface OpenStoreDependencies {
  getStoreInfo: typeof getStoreInfo
  openURL: typeof defaultOpenURL
}

const defaultDependencies: OpenStoreDependencies = {
  getStoreInfo,
  openURL: defaultOpenURL,
}

/**
 * Opens a store's storefront in the default browser.
 */
export async function openStore(
  options: OpenStoreOptions,
  dependencies: Partial<OpenStoreDependencies> = {},
): Promise<void> {
  const {getStoreInfo: getInfo, openURL} = {...defaultDependencies, ...dependencies}

  const info = await getInfo({store: options.store})
  const url = storefrontUrl(info)

  const opened = await openURL(url)
  if (opened) {
    renderInfo({headline: `Opening the storefront for ${options.store} in your browser.`})
    return
  }

  renderInfo({
    headline: `Browser didn't open automatically. Open the storefront manually:`,
    body: [outputContent`${outputToken.link(url, url)}`.value],
  })
}

function storefrontUrl(info: StoreInfoResult): string {
  // Preview stores surface a tokenized access URL; everyone else resolves to the canonical domain.
  return info.accessUrl ?? `https://${info.subdomain}`
}

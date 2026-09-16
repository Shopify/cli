import {getStoreInfo} from './info/index.js'
import {openURL as defaultOpenURL} from '@shopify/cli-kit/node/system'
import type {StoreInfoResult} from './info/types.js'
import type {OpenStoreResult} from './open/types.js'

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
): Promise<OpenStoreResult> {
  const {getStoreInfo: getInfo, openURL} = {...defaultDependencies, ...dependencies}

  const info = await getInfo({store: options.store})
  const url = storefrontUrl(info)

  const opened = await openURL(url)
  return {store: options.store, url, opened}
}

function storefrontUrl(info: StoreInfoResult): string {
  // Preview stores surface a tokenized access URL; everyone else resolves to the canonical domain.
  return info.accessUrl ?? `https://${info.subdomain}`
}

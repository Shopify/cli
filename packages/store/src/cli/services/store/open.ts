import {getStoreInfo} from './info/index.js'
import {openURL as defaultOpenURL} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import type {StoreInfoResult} from './info/types.js'

interface OpenStoreOptions {
  store: string
  admin?: boolean
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
 * Opens a store in the default browser.
 *
 * By default the storefront is opened. With `admin: true` the Shopify admin is opened instead.
 * For preview stores that don't have a resolvable admin yet, opening with `admin: true` first
 * saves the store and then lands you in the admin.
 */
export async function openStore(
  options: OpenStoreOptions,
  dependencies: Partial<OpenStoreDependencies> = {},
): Promise<void> {
  const {getStoreInfo: getInfo, openURL} = {...defaultDependencies, ...dependencies}

  const info = await getInfo({store: options.store})
  const {url, label} = resolveTarget(options, info)

  const opened = await openURL(url)
  if (opened) {
    renderInfo({headline: `Opening ${label} for ${options.store} in your browser.`})
    return
  }

  renderInfo({
    headline: `Browser didn't open automatically. Open ${label} manually:`,
    body: [outputContent`${outputToken.link(url, url)}`.value],
  })
}

function resolveTarget(options: OpenStoreOptions, info: StoreInfoResult): {url: string; label: string} {
  if (options.admin) {
    // Preview stores without a resolvable admin route through the save URL, which saves the
    // store and then opens the admin.
    if (info.adminUrl) {
      return {url: info.adminUrl, label: 'the Shopify admin'}
    }
    if (info.saveUrl) {
      return {url: info.saveUrl, label: 'the Shopify admin (saving your store first)'}
    }
    throw new AbortError(
      `Couldn't determine an admin URL for ${options.store}.`,
      'Confirm you have access to the store and that it has been created.',
    )
  }

  // Preview stores surface a tokenized access URL; everyone else resolves to the canonical domain.
  const storefrontTarget = info.accessUrl ?? `https://${info.subdomain}`
  return {url: storefrontTarget, label: 'the storefront'}
}

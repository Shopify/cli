import {UIExtension} from '../../../models/app/extensions.js'
import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'
import {file} from '@shopify/cli-kit'

/**
 * To prepare Checkout UI Extensions for dev'ing we need to retrieve a valid product variant ID
 * @param extensions {UIExtension[]} - The UI Extensions to dev
 * @param store {string} - The store FQDN
 */
export async function getCartPathFromExtensions(extensions: UIExtension[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.filter(getExtensionNeedsCartURL).length > 0
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

/**
 * Returns true if an extension needs a cart URL.
 */
export function getExtensionNeedsCartURL(extension: UIExtension) {
  return extension.configuration.type === 'checkout_ui_extension'
}

export async function getLastUpdatedTimestamp(path: string) {
  const lastUpdatedDateTime = await file.lastUpdated(path)

  return lastUpdatedDateTime.getTime()
}

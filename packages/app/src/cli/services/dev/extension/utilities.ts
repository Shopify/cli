import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'

import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'

/**
 * To prepare UI Extensions targeting Checkout for dev'ing we need to retrieve a valid product variant ID
 * @param extensions - The UI Extensions to dev
 * @param store - The store FQDN
 */
export async function buildCartURLIfNeeded(extensions: ExtensionInstance[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.filter((extension) => extension.shouldFetchCartUrl()).length > 0
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

/**
 * Returns the surface for UI extension from an extension point target
 */
export function getExtensionPointTargetSurface(extensionPointTarget: string) {
  const domain = extensionPointTarget.toLowerCase().replace(/(::|\.).+$/, '')
  const page = extensionPointTarget.split('.')[1]

  switch (domain) {
    // Covers Checkout UI extensions and Post purchase UI extensions (future)
    case 'purchase': {
      if (page === 'post') {
        return 'post_purchase'
      }

      // Checkout UI extensions
      return 'checkout'
    }

    // Covers Customer Accounts UI extensions (future)
    case 'customer-account': {
      return 'customer-accounts'
    }

    // Covers POS UI extensions (future)
    case 'pos': {
      return 'point_of_sale'
    }

    default:
      // Covers Admin UI extensions
      return domain
  }
}

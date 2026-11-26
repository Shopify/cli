import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'

import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'

/**
 * To prepare UI Extensions targeting Checkout for dev'ing we need to retrieve a valid product variant ID
 * @param extensions - The UI Extensions to dev
 * @param store - The store FQDN
 */
export async function buildCartURLIfNeeded(extensions: ExtensionInstance[], store: string, checkoutCartUrl?: string) {
  // Keep a supplied cart URL even without a checkout extension, for checkout extensions added while dev runs.
  if (checkoutCartUrl) return checkoutCartUrl
  const hasUIExtension = extensions.filter((extension) => extension.shouldFetchCartUrl()).length > 0
  if (!hasUIExtension) return undefined
  // Finding a product variant calls the store's Admin API, which a service account token can't do.
  if (isServiceAccountTokenSet()) {
    throw new AbortError(
      "A service account can't look up a product to preview checkout UI extensions.",
      'Pass a cart with --checkout-cart-url, in the format "/cart/{productVariantID}:{productQuantity}".',
    )
  }
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

import {ExtensionPointType, UIExtension} from '../../../models/app/extensions.js'
import {fetchProductVariant} from '../../../utilities/extensions/fetch-product-variant.js'

/**
 * To prepare UI Extensions targeting Checkout for dev'ing we need to retrieve a valid product variant ID
 * @param extensions - The UI Extensions to dev
 * @param store - The store FQDN
 */
export async function getCartPathFromExtensions(extensions: UIExtension[], store: string, checkoutCartUrl?: string) {
  const hasUIExtension = extensions.filter(getExtensionNeedsCartURL).length > 0
  if (!hasUIExtension) return undefined
  if (checkoutCartUrl) return checkoutCartUrl
  const variantId = await fetchProductVariant(store)
  return `/cart/${variantId}:1`
}

/**
 * Returns the surface for UI extension from an extension point target
 */
export function getExtensionPointTargetSurface(extensionPointTarget: string) {
  return extensionPointTarget.toLowerCase().replace(/\:\:.+$/, '')
}

/**
 * Returns true if an extension needs a cart URL.
 */
export function getExtensionNeedsCartURL(extension: UIExtension) {
  if (!extension.configuration.extensionPoints) {
    return false
  }

  const targetsCheckout =
    (extension.configuration.extensionPoints as any[])?.filter((extensionPoint: string | ExtensionPointType) => {
      const target = typeof extensionPoint === 'object' ? extensionPoint.target : extensionPoint
      const is = getExtensionPointTargetSurface(target) === 'checkout'
      return is
    }).length > 0

  return targetsCheckout
}

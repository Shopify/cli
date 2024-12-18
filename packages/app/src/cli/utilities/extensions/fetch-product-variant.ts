import {FindProductVariantQuery, FindProductVariantSchema} from '../../api/graphql/get_variant_id.js'
import {adminRequest} from '@shopify/cli-kit/node/api/admin'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

/**
 * Retrieve the first variant of the first product of the given store
 * @param store - Store FQDN
 * @returns variantID if exists
 */
export async function fetchProductVariant(store: string) {
  const adminSession = await ensureAuthenticatedAdmin(store)
  const result: FindProductVariantSchema = await adminRequest(FindProductVariantQuery, adminSession)
  const products = result.products.edges
  if (products.length === 0) {
    const normalizedUrl = `https://${await normalizeStoreFqdn(store)}/admin/products/new`
    const addProductLink = outputContent`${outputToken.link(
      'Add a product',
      normalizedUrl,
      `You can add a new product here: ${normalizedUrl}`,
    )}`.value
    throw new AbortError(
      'Could not find a product variant',
      `Your store needs to have at least one product to test a 'checkout_ui' extension.\n\n${addProductLink}`,
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const variantURL = result.products.edges[0]!.node.variants.edges[0]!.node.id
  const variantId = variantURL.split('/').pop()
  return variantId
}

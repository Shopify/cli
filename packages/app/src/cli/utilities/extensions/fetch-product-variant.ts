import {api, error, session} from '@shopify/cli-kit'

/**
 * Retrieve the first variant of the first product of the given store
 * @param store - Store FQDN
 * @returns variantID if exists
 */
export async function fetchProductVariant(store: string) {
  const adminSession = await session.ensureAuthenticatedAdmin(store)
  const query = api.graphql.FindProductVariantQuery
  const result: api.graphql.FindProductVariantSchema = await api.admin.request(query, adminSession)
  const products = result.products.edges
  if (products.length === 0)
    throw new error.Abort(
      'Could not find a product variant',
      `Your store needs to have at least one product to test a 'checktout_ui' extension\n
You can add a new product here: https://${store}/admin/products/new`,
    )
  const variantURL = result.products.edges[0]!.node.variants.edges[0]!.node.id
  const variantId = variantURL.split('/').pop()
  return variantId
}

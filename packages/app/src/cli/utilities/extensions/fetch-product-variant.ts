import {mapExtensionTypeToExternalExtensionType} from './name-mapper.js'
import {api, error, session} from '@shopify/cli-kit'
import {ResultAsync} from 'neverthrow'

const NoProductsError = (storeFqdn: string) => {
  return new error.Abort(
    'Could not find a product variant',
    `Your store needs to have at least one product to test a ${mapExtensionTypeToExternalExtensionType(
      'checkout_ui_extension',
    )}\n
You can add a new product here: https://${storeFqdn}/admin/products/new`,
  )
}

/**
 * Retrieve the first variant of the first product of the given store
 * @param store {string} Store FQDN
 * @returns {Promise<string>} variantID if exists
 */
export function fetchProductVariant(store: string) {
  return ResultAsync.fromPromise(session.ensureAuthenticatedAdmin(store), (err) => err)
    .andThen((adminSession) => {
      const query = api.graphql.FindProductVariantQuery
      return api.admin.request<api.graphql.FindProductVariantSchema>(query, adminSession)
    })
    .match(
      (result) => mapFetchProductVariantResult(result, store),
      (error) => {
        throw error
      },
    )
}

function mapFetchProductVariantResult(result: api.graphql.FindProductVariantSchema, store: string) {
  const products = result.products.edges
  if (products.length === 0) {
    throw NoProductsError(store)
  }
  const variantURL = products[0].node.variants.edges[0].node.id
  const variantId = variantURL.split('/').pop()
  return variantId
}

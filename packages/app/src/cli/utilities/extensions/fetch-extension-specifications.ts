import {api} from '@shopify/cli-kit'

/**
 * Fetch all extension specifications the user has access to
 * @param token - Token to access partners API
 * @returns List of extension specifications
 */
export async function fetchExtensionSpecifications(token: string, apiKey: string) {
  const query = api.graphql.ExtensionSpecificationsQuery
  const result: api.graphql.ExtensionSpecificationsQuerySchema = await api.partners.request(query, token, {
    api_key: apiKey,
  })
  const extensionSpecifications = result.extensionSpecifications
    .filter((specification) => specification.options.managementExperience === 'cli')
    .map((spec) => {
      // WORKAROUND: The identifiers in the API are different for these extensions to the ones the CLI
      // has been using so far. This is a workaround to keep the CLI working until the API is updated.
      if (spec.identifier === 'theme_app_extension') spec.identifier = 'theme'
      if (spec.identifier === 'subscription_management') spec.identifier = 'product_subscription'
      return spec
    })

  return extensionSpecifications
}

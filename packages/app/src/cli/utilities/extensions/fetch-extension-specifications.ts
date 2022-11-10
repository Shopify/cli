import {api} from '@shopify/cli-kit'

/**
 * Fetch all extension specifications the user has access to
 * @param token - Token to access partners API
 * @returns List of extension specifications
 */
export async function fetchExtensionSpecifications(token: string) {
  const query = api.graphql.ExtensionSpecificationsQuery
  const result: api.graphql.ExtensionSpecificationsQuerySchema = await api.partners.request(query, token)
  const extensionSpecifications = result.extensionSpecifications.filter(
    (specification) => specification.options.managementExperience === 'cli',
  )
  return extensionSpecifications
}

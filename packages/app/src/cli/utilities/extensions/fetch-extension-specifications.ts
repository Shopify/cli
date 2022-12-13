import {ExtensionSpec} from '../../models/extensions/extensions.js'
import {api} from '@shopify/cli-kit'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

/**
 * Fetch all extension specifications the user has access to
 * Will return a merge of the local and remote specs (remote values override local ones)
 * Will only return the specifications that are also defined locally
 * @param token - Token to access partners API
 * @returns List of extension specifications
 */
export async function fetchExtensionSpecifications(
  token: string,
  apiKey: string,
  localSpecs: ExtensionSpec[],
): Promise<ExtensionSpec[]> {
  const query = api.graphql.ExtensionSpecificationsQuery
  const result: api.graphql.ExtensionSpecificationsQuerySchema = await api.partners.request(query, token, {
    api_key: apiKey,
  })
  const extensionSpecifications: Partial<ExtensionSpec>[] = result.extensionSpecifications
    .filter((specification) => specification.options.managementExperience === 'cli')
    .map((spec) => {
      const newSpec: Partial<ExtensionSpec> = spec
      // WORKAROUND: The identifiers in the API are different for these extensions to the ones the CLI
      // has been using so far. This is a workaround to keep the CLI working until the API is updated.
      if (spec.identifier === 'theme_app_extension') spec.identifier = 'theme'
      if (spec.identifier === 'subscription_management') spec.identifier = 'product_subscription'
      newSpec.registrationLimit = spec.options.registrationLimit
      newSpec.surface = spec.features?.argo?.surface
      return newSpec
    })

  return mergeLocalAndRemoteSpecs(localSpecs, extensionSpecifications)
}

function mergeLocalAndRemoteSpecs(local: ExtensionSpec[], remote: Partial<ExtensionSpec>[]): ExtensionSpec[] {
  const updated = local.map((spec) => {
    const remoteSpec = remote.find((remote) => remote.identifier === spec.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec}
    return undefined
  })
  return getArrayRejectingUndefined(updated)
}

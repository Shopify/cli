import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {FlattenedRemoteSpecification, RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

interface FetchSpecificationsOptions {
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
}
/**
 * Returns all extension specifications the user has access to.
 * This includes:
 * - UI extensions
 * - Theme extensions
 *
 * Will return a merge of the local and remote specifications (remote values override local ones)
 * Will only return the specifications that are also defined locally
 *
 * @param developerPlatformClient - The client to access the platform API
 * @returns List of extension specifications
 */
export async function fetchSpecifications({
  developerPlatformClient,
  apiKey,
}: FetchSpecificationsOptions): Promise<ExtensionSpecification[]> {
  const result: RemoteSpecification[] = await developerPlatformClient.specifications(apiKey)

  const extensionSpecifications: FlattenedRemoteSpecification[] = result
    .filter((specification) => ['extension', 'configuration'].includes(specification.experience))
    .map((spec) => {
      const newSpec = spec as FlattenedRemoteSpecification
      // WORKAROUND: The identifiers in the API are different for these extensions to the ones the CLI
      // has been using so far. This is a workaround to keep the CLI working until the API is updated.
      if (spec.identifier === 'theme_app_extension') spec.identifier = 'theme'
      if (spec.identifier === 'subscription_management') spec.identifier = 'product_subscription'
      newSpec.registrationLimit = spec.options.registrationLimit
      newSpec.surface = spec.features?.argo?.surface

      // Hardcoded value for the post purchase extension because the value is wrong in the API
      if (spec.identifier === 'checkout_post_purchase') newSpec.surface = 'post_purchase'

      return newSpec
    })

  const local = await loadLocalExtensionsSpecifications()
  const updatedSpecs = mergeLocalAndRemoteSpecs(local, extensionSpecifications)
  return [...updatedSpecs]
}

function mergeLocalAndRemoteSpecs(
  local: ExtensionSpecification[],
  remote: FlattenedRemoteSpecification[],
): ExtensionSpecification[] {
  const updated = local.map((spec) => {
    const remoteSpec = remote.find((remote) => remote.identifier === spec.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec} as ExtensionSpecification
    return undefined
  })

  return getArrayRejectingUndefined<ExtensionSpecification>(updated)
}

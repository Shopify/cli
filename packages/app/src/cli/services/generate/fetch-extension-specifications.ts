import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {FlattenedRemoteSpecification, RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {
  createContractBasedModuleSpecification,
  ExtensionSpecification,
  RemoteAwareExtensionSpecification,
} from '../../models/extensions/specification.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {unifiedConfigurationParserFactory} from '../../utilities/json-schema.js'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {HandleInvalidAdditionalProperties, normaliseJsonSchema} from '@shopify/cli-kit/node/json-schema'

interface FetchSpecificationsOptions {
  developerPlatformClient: DeveloperPlatformClient
  app: MinimalAppIdentifiers
}
/**
 * Returns all extension specifications the user has access to.
 * This includes:
 * - UI extensions
 * - Theme extensions
 *
 * Will return a merge of the local and remote specifications (remote values override local ones)
 * - Will only return the specifications that are defined in both places.
 * - "deprecated" extension specifications aren't included
 *
 * @param developerPlatformClient - The client to access the platform API
 * @returns List of extension specifications
 */
export async function fetchSpecifications({
  developerPlatformClient,
  app,
}: FetchSpecificationsOptions): Promise<RemoteAwareExtensionSpecification[]> {
  const result: RemoteSpecification[] = await developerPlatformClient.specifications(app)

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

      // Hardcoded value for the webhook_subscription extension because the value is wrong in the API
      if (spec.identifier === 'webhook_subscription') spec.experience = 'configuration'

      return newSpec
    })

  const local = await loadLocalExtensionsSpecifications()
  const updatedSpecs = await mergeLocalAndRemoteSpecs(local, extensionSpecifications)
  return [...updatedSpecs]
}

async function mergeLocalAndRemoteSpecs(
  local: ExtensionSpecification[],
  remote: FlattenedRemoteSpecification[],
): Promise<RemoteAwareExtensionSpecification[]> {
  // Iterate over the remote specs and merge them with the local ones
  // If the local spec is missing, and the remote one has a validation schema, create a new local spec using contracts
  const updated = remote.map(async (remoteSpec) => {
    let localSpec = local.find((local) => local.identifier === remoteSpec.identifier)
    if (!localSpec && remoteSpec.validationSchema?.jsonSchema) {
      const normalisedSchema = await normaliseJsonSchema(remoteSpec.validationSchema.jsonSchema)
      const hasLocalization = normalisedSchema.properties?.localization !== undefined
      localSpec = createContractBasedModuleSpecification({
        identifier: remoteSpec.identifier,
        uidStrategy: remoteSpec.options.uidStrategy,
        appModuleFeatures: () => (hasLocalization ? ['localization'] : []),
      })
      // Seed uidStrategy for contract specs using uidIsClientProvided as fallback (Partners API path).
      // This will be overridden below if the backend provides a typename-derived value.
      localSpec.uidStrategy =
        remoteSpec.options.uidStrategy ?? (remoteSpec.options.uidIsClientProvided ? 'uuid' : 'single')
    }
    if (!localSpec) return undefined

    const merged = {...localSpec, ...remoteSpec, loadedRemoteSpecs: true} as RemoteAwareExtensionSpecification &
      FlattenedRemoteSpecification

    // Always prefer the backend-derived uidStrategy (from __typename) when available.
    // This correctly overrides the local spec's default (e.g. channel_config defaults to 'uuid'
    // locally but the backend defines it as 'single').
    // Falls back to the local spec value for the Partners API path (no __typename available).
    merged.uidStrategy = merged.options.uidStrategy ?? localSpec.uidStrategy ?? 'single'

    // If configuration is inside an app.toml -- i.e. single UID mode -- we must be able to parse a partial slice.
    // DEPRECATED: not all single specs are config specs.
    // Should be removed once we can get the experience from the API.
    let handleInvalidAdditionalProperties: HandleInvalidAdditionalProperties
    switch (merged.uidStrategy) {
      case 'uuid':
        handleInvalidAdditionalProperties = 'fail'
        break
      case 'single':
        handleInvalidAdditionalProperties = 'strip'
        break
      case 'dynamic':
        handleInvalidAdditionalProperties = 'fail'
        break
    }

    // If the experience is 'configuration', force strip.
    if (merged.experience === 'configuration') {
      handleInvalidAdditionalProperties = 'strip'
    }

    const parseConfigurationObject = await unifiedConfigurationParserFactory(merged, handleInvalidAdditionalProperties)

    return {
      ...merged,
      parseConfigurationObject,
    }
  })

  const result = getArrayRejectingUndefined<RemoteAwareExtensionSpecification>(await Promise.all(updated))

  // Log the specs that were defined locally but aren't in the result
  // This usually means the spec is a gated one and the caller doesn't have adequate access. Or, we're in a test and
  // the mocked specification set is missing something.
  const presentLocalMissingRemote = local.filter(
    (spec) => !result.find((result) => result.identifier === spec.identifier),
  )
  if (presentLocalMissingRemote.length > 0) {
    outputDebug(
      `The following extension specifications were defined locally but not found in the remote specifications: ${presentLocalMissingRemote
        .map((spec) => spec.identifier)
        .sort()
        .join(', ')}`,
    )
  }

  const presentRemoteMissingLocal = remote.filter(
    (spec) => !result.find((result) => result.identifier === spec.identifier),
  )
  if (presentRemoteMissingLocal.length > 0) {
    outputDebug(
      `The following extension specifications were found in the remote specifications but not defined locally: ${presentRemoteMissingLocal
        .map((spec) => spec.identifier)
        .sort()
        .join(', ')}`,
    )
  }

  return result
}

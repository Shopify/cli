import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {
  ExtensionSpecificationsQuery,
  ExtensionSpecificationsQuerySchema,
  FlattenedRemoteSpecification,
} from '../../api/graphql/extension_specifications.js'

import {ConfigExtensionSpecification, ExtensionSpecification} from '../../models/extensions/specification.js'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Config} from '@oclif/core'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export interface FetchSpecificationsOptions {
  token: string
  apiKey: string
  config: Config
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
 * @param token - Token to access partners API
 * @returns List of extension specifications
 */
export async function fetchSpecifications({token, apiKey, config}: FetchSpecificationsOptions): Promise<{
  generalSpecifications: ExtensionSpecification[]
  configSpecifications: ConfigExtensionSpecification[]
}> {
  const result: ExtensionSpecificationsQuerySchema = await partnersRequest(ExtensionSpecificationsQuery, token, {
    api_key: apiKey,
  })

  const extensionSpecifications: FlattenedRemoteSpecification[] = result.extensionSpecifications
    .filter((specification) => ['cli', 'app_config'].includes(specification.options.managementExperience))
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

  const local = await loadLocalExtensionsSpecifications(config)
  const updatedSpecs = mergeLocalAndRemoteSpecs(local.generalSpecifications, extensionSpecifications)
  const updatedConfigSpecs = mergeLocalAndRemoteSpecs(local.configSpecifications, extensionSpecifications)
  return {generalSpecifications: updatedSpecs, configSpecifications: updatedConfigSpecs}
}

function mergeLocalAndRemoteSpecs<T>(local: T[], remote: FlattenedRemoteSpecification[]): T[] {
  const updated = local.map((spec) => {
    const specObject = spec as {[key: string]: unknown}
    if (!specObject.identifier) return undefined
    const remoteSpec = remote.find((remote) => remote.identifier === specObject.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec} as T
    return undefined
  })

  return getArrayRejectingUndefined<T>(updated)
}

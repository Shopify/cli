import {loadThemeSpecifications, loadUIExtensionSpecifications} from '../../models/extensions/specifications.js'
import {UIExtensionSpec} from '../../models/extensions/ui.js'
import {ThemeExtensionSpec} from '../../models/extensions/theme.js'
import {GenericSpecification} from '../../models/app/extensions.js'
import {
  ExtensionSpecificationsQuery,
  ExtensionSpecificationsQuerySchema,
  FlattenedRemoteSpecification,
} from '../../api/graphql/extension_specifications.js'

import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Config} from '@oclif/core'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

type ExtensionSpec = UIExtensionSpec | ThemeExtensionSpec

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
export async function fetchSpecifications({
  token,
  apiKey,
  config,
}: FetchSpecificationsOptions): Promise<GenericSpecification[]> {
  const result: ExtensionSpecificationsQuerySchema = await partnersRequest(ExtensionSpecificationsQuery, token, {
    api_key: apiKey,
  })

  const extensionSpecifications: FlattenedRemoteSpecification[] = result.extensionSpecifications
    .filter((specification) => specification.options.managementExperience === 'cli')
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

  const ui = await loadUIExtensionSpecifications(config)
  const theme = await loadThemeSpecifications()
  const local = [...ui, ...theme]

  const updatedSpecs = mergeLocalAndRemoteSpecs(local, extensionSpecifications)
  return [...updatedSpecs]
}

function mergeLocalAndRemoteSpecs(
  local: ExtensionSpec[],
  remote: FlattenedRemoteSpecification[],
): GenericSpecification[] {
  const updated = local.map((spec) => {
    const remoteSpec = remote.find((remote) => remote.identifier === spec.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec}
    return undefined
  })

  return getArrayRejectingUndefined<GenericSpecification>(updated)
}

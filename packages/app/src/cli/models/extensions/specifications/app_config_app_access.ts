import {validateUrl} from '../../app/validation/common.js'
import {
  CustomTransformationConfig,
  TransformationConfig,
  appConfigTransform,
  createConfigExtensionSpecification,
} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

export const AppAccessScopesSchema = zod.object({
  scopes: zod
    .string()
    .transform((scopes) => normalizeDelimitedString(scopes) ?? '')
    .optional(),
  required_scopes: zod.array(zod.string()).optional(),
  optional_scopes: zod.array(zod.string()).optional(),
  use_legacy_install_flow: zod.boolean().optional(),
})

export const AppAuthSchema = zod.object({
  redirect_urls: zod.array(validateUrl(zod.string())),
})

const AppAccessSchema = BaseSchemaWithoutHandle.extend({
  access: zod
    .object({
      admin: zod
        .object({
          direct_api_mode: zod.union([zod.literal('online'), zod.literal('offline')]).optional(),
          embedded_app_direct_api_access: zod.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  access_scopes: AppAccessScopesSchema.optional(),
  auth: AppAuthSchema,
})

export const AppAccessSpecIdentifier = 'app_access'

const AppAccessFieldMapping: TransformationConfig = {
  access: 'access',
  scopes: 'access_scopes.scopes',
  required_scopes: 'access_scopes.required_scopes',
  optional_scopes: 'access_scopes.optional_scopes',
  use_legacy_install_flow: 'access_scopes.use_legacy_install_flow',
  redirect_url_allowlist: 'auth.redirect_urls',
}

/**
 * The platform stores Shop scopes (e.g. `shop_app:oauth`) in a separate `shop_scopes` field, split out of
 * `scopes` when a version is created. Locally they live in `access_scopes.scopes`, so fold them back in.
 * Without this, `config link` writes a TOML without the Shop scopes and the next deploy removes them.
 *
 * @param remoteContent - The app_access module config as returned by the platform
 * @returns The config with `shop_scopes` merged into `scopes` and removed
 */
function mergeShopScopesIntoScopes(remoteContent: {[key: string]: unknown}): {[key: string]: unknown} {
  const {shop_scopes: shopScopes, ...rest} = remoteContent
  const shopScopesString = typeof shopScopes === 'string' ? normalizeDelimitedString(shopScopes) : undefined
  if (!shopScopesString) return rest

  const platformScopes = typeof rest.scopes === 'string' ? rest.scopes : ''
  return {...rest, scopes: normalizeDelimitedString([platformScopes, shopScopesString].join(','))}
}

const AppAccessTransformConfig: CustomTransformationConfig = {
  forward: (content) => appConfigTransform(content, AppAccessFieldMapping),
  reverse: (content) =>
    appConfigTransform(mergeShopScopesIntoScopes(content as {[key: string]: unknown}), AppAccessFieldMapping, true),
}

const appAccessSpec = createConfigExtensionSpecification({
  identifier: AppAccessSpecIdentifier,
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
  getDevSessionUpdateMessages: async (config) => {
    const hasAccessModule = config.access_scopes !== undefined
    const isLegacyInstallFlow = config.access_scopes?.use_legacy_install_flow === true
    const hasNoScopes = config.access_scopes?.scopes == null && config.access_scopes?.required_scopes == null

    if (isLegacyInstallFlow || (hasAccessModule && hasNoScopes)) {
      return [`Using legacy install flow - access scopes are not auto-granted`]
    }

    const scopesString = config.access_scopes?.scopes
      ? config.access_scopes.scopes
          .split(',')
          .map((scope) => scope.trim())
          .join(', ')
      : config.access_scopes?.required_scopes?.join(', ')

    return scopesString ? [`Access scopes auto-granted: ${scopesString}`] : [`App has been installed`]
  },
  patchWithAppDevURLs: (config, urls) => {
    if (urls.redirectUrlWhitelist) {
      config.auth = {redirect_urls: urls.redirectUrlWhitelist}
    }
  },
})

export default appAccessSpec

import {validateUrl} from '../../app/validation/common.js'
import {configWithoutFirstClassFields, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

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
  access_scopes: zod
    .object({
      scopes: zod
        .string()
        .transform((scopes) => normalizeDelimitedString(scopes) ?? '')
        .optional(),
      required_scopes: zod.array(zod.string()).optional(),
      optional_scopes: zod.array(zod.string()).optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod.object({
    redirect_urls: zod.array(validateUrl(zod.string())),
  }),
})

export const AppAccessSpecIdentifier = 'app_access'

const appAccessSpec = createConfigExtensionSpecification({
  identifier: AppAccessSpecIdentifier,
  schema: AppAccessSchema,
  deployConfig: async (config) => {
    const {name, ...rest} = configWithoutFirstClassFields(config)
    return rest
  },
  transformRemoteToLocal: (remoteContent: object) => {
    const remote = remoteContent as {[key: string]: unknown}
    const result: {[key: string]: unknown} = {}

    if (remote.access !== undefined) {
      result.access = remote.access
    }

    const accessScopes: {[key: string]: unknown} = {}
    if (remote.scopes !== undefined) accessScopes.scopes = remote.scopes
    if (remote.required_scopes !== undefined) accessScopes.required_scopes = remote.required_scopes
    if (remote.optional_scopes !== undefined) accessScopes.optional_scopes = remote.optional_scopes
    if (remote.use_legacy_install_flow !== undefined)
      accessScopes.use_legacy_install_flow = remote.use_legacy_install_flow
    if (Object.keys(accessScopes).length > 0) {
      result.access_scopes = accessScopes
    }

    if (remote.redirect_url_allowlist !== undefined) {
      result.auth = {redirect_urls: remote.redirect_url_allowlist}
    }

    return result
  },
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

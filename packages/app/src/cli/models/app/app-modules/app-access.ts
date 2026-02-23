import {AppModule, EncodeContext} from '../app-module.js'
import {BaseSchemaWithoutHandle} from '../../extensions/schemas.js'
import {validateUrl} from '../../app/validation/common.js'
import {normalizeDelimitedString} from '@shopify/cli-kit/common/string'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessTomlSchema = BaseSchemaWithoutHandle.extend({
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

type AppAccessToml = zod.infer<typeof AppAccessTomlSchema>

interface AppAccessContract {
  access?: {admin?: {direct_api_mode?: string; embedded_app_direct_api_access?: boolean}}
  scopes?: string
  required_scopes?: string[]
  optional_scopes?: string[]
  use_legacy_install_flow?: boolean
  redirect_url_allowlist?: string[]
}

class AppAccessModule extends AppModule<AppAccessToml, AppAccessContract> {
  constructor() {
    super({identifier: 'app_access', uidStrategy: 'single', tomlKeys: ['access', 'access_scopes', 'auth']})
  }

  async encode(toml: AppAccessToml, _context: EncodeContext) {
    const result: AppAccessContract = {}
    if (toml.access !== undefined) result.access = toml.access
    if (toml.access_scopes?.scopes !== undefined) result.scopes = toml.access_scopes.scopes
    if (toml.access_scopes?.required_scopes !== undefined) result.required_scopes = toml.access_scopes.required_scopes
    if (toml.access_scopes?.optional_scopes !== undefined) result.optional_scopes = toml.access_scopes.optional_scopes
    if (toml.access_scopes?.use_legacy_install_flow !== undefined)
      result.use_legacy_install_flow = toml.access_scopes.use_legacy_install_flow
    if (toml.auth?.redirect_urls !== undefined) result.redirect_url_allowlist = toml.auth.redirect_urls
    return result
  }

  decode(contract: AppAccessContract) {
    const result: {[key: string]: unknown} = {}
    if (contract.access !== undefined) result.access = contract.access

    const accessScopes: {[key: string]: unknown} = {}
    if (contract.scopes !== undefined) accessScopes.scopes = contract.scopes
    if (contract.required_scopes !== undefined) accessScopes.required_scopes = contract.required_scopes
    if (contract.optional_scopes !== undefined) accessScopes.optional_scopes = contract.optional_scopes
    if (contract.use_legacy_install_flow !== undefined)
      accessScopes.use_legacy_install_flow = contract.use_legacy_install_flow
    if (Object.keys(accessScopes).length > 0) result.access_scopes = accessScopes

    if (contract.redirect_url_allowlist !== undefined) {
      result.auth = {redirect_urls: contract.redirect_url_allowlist}
    }
    return result as AppAccessToml
  }
}

export const appAccessModule = new AppAccessModule()

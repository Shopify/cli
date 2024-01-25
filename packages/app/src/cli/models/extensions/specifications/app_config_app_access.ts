import {validateUrl} from '../../app/validation/common.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessSchema = zod.object({
  access: zod
    .object({
      direct_api_offline_access: zod.boolean().optional(),
    })
    .optional(),
  access_scopes: zod
    .object({
      scopes: zod.string().optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod.object({
    redirect_urls: zod.array(validateUrl(zod.string())),
  }),
})

export const AppAccessSpecIdentifier = 'app_access'

const AppAccessTransformConfig: TransformationConfig = {
  access: 'access',
  scopes: 'access_scopes.scopes',
  use_legacy_install_flow: 'access_scopes.use_legacy_install_flow',
  redirect_url_allowlist: 'auth.redirect_urls',
}

const spec = createConfigExtensionSpecification({
  identifier: AppAccessSpecIdentifier,
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
})

export default spec

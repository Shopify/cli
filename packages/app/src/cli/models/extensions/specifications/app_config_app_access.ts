import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessSchema = zod.object({
  access_scopes: zod
    .object({
      scopes: zod.string().optional(),
      use_legacy_install_flow: zod.boolean().optional(),
    })
    .optional(),
  auth: zod
    .object({
      redirect_urls: zod.array(zod.string()),
    })
    .optional(),
  access: zod
    .object({
      admin: zod.object({
        mode: zod.enum(['online', 'offline']).optional(),
      }),
      customer_account: zod.boolean().optional(),
    })
    .optional(),
})

const AppAccessTransformConfig: TransformationConfig = {
  schema: {
    scopes: 'access_scopes.scopes',
    use_legacy_install_flow: 'access_scopes.use_legacy_install_flow',
    admin: 'access.admin',
    customer_account: 'access.customer_account',
    redirect_urls: 'auth.redirect_urls',
  },
}

const AppAccessValidateConfig = {
  'auth.redirect_urls': 'url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_access',
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
  validateConfig: AppAccessValidateConfig,
})

export default spec

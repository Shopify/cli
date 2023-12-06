import {AppSchema} from '../../app/app.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const AppAccessSchema = AppSchema.pick({access_scopes: true, auth: true, access: true}).strip()

const AppAccessTransformConfig: TransformationConfig = {
  scopes: 'access_scopes.scopes',
  use_legacy_install_flow: 'access_scopes.use_legacy_install_flow',
  admin: 'access.admin',
  customer_account: 'access.customer_account',
  redirect_urls: 'auth.redirect_urls',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_access',
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
})

export default spec

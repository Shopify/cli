import {AppSchema} from '../../app/app.js'
import {APP_ACCESS_IDENTIFIER} from '../app-config.js'
import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

export const APP_CONFIG_FEATURE = 'app_config'

// We are calling `strip()` to remove the `strict()` setting in the base AppSchema
const AppAccessSchema = BaseSchema.merge(AppSchema.pick({access: true})).strip()

const spec = createExtensionSpecification({
  identifier: APP_ACCESS_IDENTIFIER,
  schema: AppAccessSchema,
  appModuleFeatures: () => [APP_CONFIG_FEATURE],
  deployConfig: async (config) => ({access: config.access}),
})

export default spec

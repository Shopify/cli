import {AppSchema} from '../../app/app.js'
import {CUSTOM_DATA_IDENTIFIER} from '../app-config.js'
import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

// We are calling `strip()` to remove the `strict()` setting in the base AppSchema
const CustomDataSchema = BaseSchema.merge(AppSchema.pick({custom_data: true})).strip()

const spec = createExtensionSpecification({
  identifier: CUSTOM_DATA_IDENTIFIER,
  schema: CustomDataSchema,
  appModuleFeatures: () => ['app_config'],
  deployConfig: async (config) => ({custom_data: config.custom_data}),
})

export default spec

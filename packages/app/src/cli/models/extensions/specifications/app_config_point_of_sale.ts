import {AppSchema} from '../../app/app.js'
import {ZodSchemaType, BaseConfigType} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

const PosConfigurationSchema = AppSchema.pick({pos: true}).strip()

const spec = createExtensionSpecification({
  identifier: 'point_of_sale',
  schema: PosConfigurationSchema as unknown as ZodSchemaType<BaseConfigType>,
  appModuleFeatures: () => ['app_config'],
})

export default spec

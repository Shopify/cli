import {AppSchema} from '../../app/app.js'
import {createConfigExtensionSpecification} from '../specification.js'

const PosConfigurationSchema = AppSchema.pick({pos: true}).strip()

const spec = createConfigExtensionSpecification({
  identifier: 'point_of_sale',
  schema: PosConfigurationSchema,
})

export default spec

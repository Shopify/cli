import {AppSchema} from '../../app/app.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const AppAccessSchema = AppSchema.pick({access: true}).strip()

const AppAccessTransformConfig: TransformationConfig = {
  access: 'access',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_access',
  schema: AppAccessSchema,
  transformConfig: AppAccessTransformConfig,
})

export default spec

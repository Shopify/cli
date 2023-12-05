import {AppSchema} from '../../app/app.js'
import {createConfigExtensionSpecification} from '../specification.js'

const AppProxySchema = AppSchema.pick({app_proxy: true}).strip()

const spec = createConfigExtensionSpecification({
  identifier: 'app_proxy',
  schema: AppProxySchema,
})

export default spec

import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {AppSchema} from '../../app/app.js'

const AppHomeSchema = AppSchema.pick({application_url: true, embedded: true, app_preferences: true}).strip()

const AppHomeTransformConfig: TransformationConfig = {
  app_url: 'application_url',
  embedded: 'embedded',
  preferences_url: 'app_preferences.url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_home',
  schema: AppHomeSchema,
  transformConfig: AppHomeTransformConfig,
})

export default spec

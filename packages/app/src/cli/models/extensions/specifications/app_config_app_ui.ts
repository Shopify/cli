import {AppSchema} from '../../app/app.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'

const AppUiSchema = AppSchema.pick({application_url: true, embedded: true, app_preferences: true}).strip()

const AppUiTransformConfig: TransformationConfig = {
  app_url: 'application_url',
  embedded: 'embedded',
  preferences_url: 'app_preferences.url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_ui',
  schema: AppUiSchema,
  transformConfig: AppUiTransformConfig,
})

export default spec

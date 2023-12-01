import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppUiSchema = zod.object({
  application_url: zod.string(),
  embedded: zod.boolean(),
  app_preferences: zod
    .object({
      url: zod.string(),
    })
    .optional(),
})

const AppUiTransformConfig: TransformationConfig = {
  schema: {
    app_url: 'application_url',
    embedded: 'embedded',
    preferences_url: 'app_preferences.url',
  },
}

const AppUiValidateConfig = {
  application_url: 'url',
  'app_preferences.url': 'url',
}

const spec = createConfigExtensionSpecification({
  identifier: 'app_ui',
  schema: AppUiSchema,
  transformConfig: AppUiTransformConfig,
  validateConfig: AppUiValidateConfig,
})

export default spec

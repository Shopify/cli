import {validateUrl} from './configuration/schema.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeSchema = zod.object({
  application_url: validateUrl(zod.string()),
  embedded: zod.boolean(),
  app_preferences: zod
    .object({
      url: validateUrl(zod.string().max(255)),
    })
    .optional(),
})

const AppHomeTransformConfig: TransformationConfig = {
  app_url: 'application_url',
  embedded: 'embedded',
  preferences_url: 'app_preferences.url',
}

export type AppHomeConfiguration = zod.infer<typeof AppHomeSchema>
export const AppHomeSpecIdentifier = 'app_home'

const spec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  schema: AppHomeSchema,
  transformConfig: AppHomeTransformConfig,
  position: 4,
})

export default spec

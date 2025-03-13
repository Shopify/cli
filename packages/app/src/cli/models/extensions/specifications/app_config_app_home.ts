import {validateUrl} from '../../app/validation/common.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const AppHomeSpecIdentifier = 'app_home'

// name & type are not required for app home
// They are added just to conform to the BaseConfigType interface and have strongly typed functions.
// They are ignored when deploying by the `transformConfig` function.
const AppHomeSchema = zod.object({
  name: zod.string().optional().default(AppHomeSpecIdentifier),
  type: zod.string().optional().default(AppHomeSpecIdentifier),
  application_url: validateUrl(zod.string({required_error: 'Valid URL is required'})),
  embedded: zod.boolean({required_error: 'Boolean is required', invalid_type_error: 'Value must be Boolean'}),
  app_preferences: zod
    .object({
      url: validateUrl(zod.string().max(255, {message: 'String must be less than 255 characters'})),
    })
    .optional(),
})

const AppHomeTransformConfig: TransformationConfig = {
  app_url: 'application_url',
  embedded: 'embedded',
  preferences_url: 'app_preferences.url',
}

const appHomeSpec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  schema: AppHomeSchema,
  transformConfig: AppHomeTransformConfig,
  patchWithAppDevURLs: (config, urls) => {
    config.application_url = urls.applicationUrl
  },
})

export default appHomeSpec

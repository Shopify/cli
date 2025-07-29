import {validateUrl} from '../../app/validation/common.js'
import {BaseSchema} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeSchema = BaseSchema.extend({
  application_url: validateUrl(
    zod.string({
      error: (issue) => {
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
          return 'Valid URL is required'
        }
        return issue.message
      },
    }),
  ),
  embedded: zod.boolean({
    error: (issue) => {
      if (issue.code === 'invalid_type' && issue.received === 'undefined') {
        return 'Boolean is required'
      }
      if (issue.code === 'invalid_type') {
        return 'Value must be Boolean'
      }
      return issue.message
    },
  }),
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

export const AppHomeSpecIdentifier = 'app_home'

const appHomeSpec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  schema: AppHomeSchema,
  transformConfig: AppHomeTransformConfig,
  patchWithAppDevURLs: (config, urls) => {
    const typedConfig = config as zod.infer<typeof AppHomeSchema>
    typedConfig.application_url = urls.applicationUrl
  },
})

export default appHomeSpec

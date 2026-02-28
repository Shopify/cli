import {validateUrl} from '../../app/validation/common.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {configWithoutFirstClassFields, createConfigExtensionSpecification} from '../specification.js'
import {getPathValue, setPathValue} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'

const AppHomeSchema = BaseSchemaWithoutHandle.extend({
  application_url: validateUrl(zod.string({required_error: 'Valid URL is required'})),
  embedded: zod.boolean({required_error: 'Boolean is required', invalid_type_error: 'Value must be Boolean'}),
  app_preferences: zod
    .object({
      url: validateUrl(zod.string().max(255, {message: 'String must be less than 255 characters'})),
    })
    .optional(),
})

export const AppHomeSpecIdentifier = 'app_home'

const appHomeSpec = createConfigExtensionSpecification({
  identifier: AppHomeSpecIdentifier,
  schema: AppHomeSchema,
  deployConfig: async (config) => {
    const {name, ...rest} = configWithoutFirstClassFields(config)
    return rest
  },
  transformRemoteToLocal: (remoteContent: object) => {
    const result: {[key: string]: unknown} = {}
    const appUrl = getPathValue(remoteContent, 'app_url')
    if (appUrl !== undefined) result.application_url = appUrl
    const embedded = getPathValue(remoteContent, 'embedded')
    if (embedded !== undefined) result.embedded = embedded
    const preferencesUrl = getPathValue(remoteContent, 'preferences_url')
    if (preferencesUrl !== undefined) setPathValue(result, 'app_preferences.url', preferencesUrl)
    return result
  },
  patchWithAppDevURLs: (config, urls) => {
    config.application_url = urls.applicationUrl
  },
  getDevSessionUpdateMessages: async (config) => {
    return [`Using URL: ${config.application_url}`]
  },
})

export default appHomeSpec

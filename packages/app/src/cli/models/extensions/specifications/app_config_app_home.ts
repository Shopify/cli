import {ClientName} from '../../../utilities/developer-platform-client.js'
import {validateUrl} from '../../app/validation/common.js'
import {ZodSchemaType} from '../schemas.js'
import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const applicationUrlValidator = validateUrl(zod.string({required_error: 'Valid URL is required'}))
const embeddedValidator = zod.boolean({
  required_error: 'Boolean is required',
  invalid_type_error: 'Value must be Boolean',
})

const AppHomeSchema = zod.object({
  application_url: applicationUrlValidator.optional(),
  embedded: embeddedValidator.optional(),
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
  customizeSchemaForDevPlatformClient: (platformClientName: ClientName, currentSchema: ZodSchemaType<unknown>) => {
    if (platformClientName === ClientName.Partners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (currentSchema as any).merge(
        zod.object({
          application_url: applicationUrlValidator,
          embedded: embeddedValidator,
        }),
      )
    }

    return currentSchema
  },
})

export default appHomeSpec

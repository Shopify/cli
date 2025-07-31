import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BrandingSchema = BaseSchema.extend({
  name: zod
    .string({
      error: (issue) => {
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
          return 'String is required'
        }
        return issue.message
      },
    })
    .max(30, {message: 'String must be less than 30 characters'}),
  handle: zod
    .string({
      error: (issue) => {
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
          return 'String is required'
        }
        return issue.message
      },
    })
    .max(256, {message: 'String must be less than 256 characters long'})
    .refine((value) => value && /^\w*(?!-)[a-z0-9-]+(?<!-)$/.test(value), {
      message: "String can't contain special characters",
    })
    .optional(),
})

const BrandingTransformConfig: TransformationConfig = {
  name: 'name',
  app_handle: 'handle',
}

export const BrandingSpecIdentifier = 'branding'

const appBrandingSpec = createConfigExtensionSpecification({
  identifier: BrandingSpecIdentifier,
  schema: BrandingSchema,
  transformConfig: BrandingTransformConfig,
})

export default appBrandingSpec

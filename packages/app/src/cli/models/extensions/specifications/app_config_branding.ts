import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BrandingSchema = BaseSchema.extend({
  name: zod.string({required_error: 'String is required'}).max(30, {message: 'String must be less than 30 characters'}),
  handle: zod
    .string({required_error: 'String is required'})
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
  hardcodedInputJsonSchema: JSON.stringify({
    type: 'object',
    properties: {
      name: {
        type: 'string',
        maxLength: 30,
      },
      handle: {
        type: 'string',
        maxLength: 256,
        pattern: '^[a-zA-Z0-9_-]+$',
      },
    },
    required: ['name'],
  }),
})

export default appBrandingSpec

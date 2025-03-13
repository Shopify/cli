import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const BrandingSpecIdentifier = 'branding'

// type is not required for branding
// They are added just to conform to the BaseConfigType interface and have strongly typed functions.
// They are ignored when deploying by the `transformConfig` function.
const BrandingSchema = zod.object({
  name: zod.string({required_error: 'String is required'}).max(30, {message: 'String must be less than 30 characters'}),
  type: zod.string().optional().default(BrandingSpecIdentifier),
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

const appBrandingSpec = createConfigExtensionSpecification({
  identifier: BrandingSpecIdentifier,
  schema: BrandingSchema,
  transformConfig: BrandingTransformConfig,
})

export default appBrandingSpec

import {TransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BrandingSchema = zod.object({
  name: zod.string().max(30),
  handle: zod
    .string()
    .max(256)
    .refine((value) => value && /^\w*(?!-)[a-z0-9-]+(?<!-)$/.test(value))
    .optional(),
})

const BrandingTransformConfig: TransformationConfig = {
  name: 'name',
  app_handle: 'handle',
}

export const BrandingSpecIdentifier = 'branding'

const spec = createConfigExtensionSpecification({
  identifier: BrandingSpecIdentifier,
  schema: BrandingSchema,
  transformConfig: BrandingTransformConfig,
})

export default spec

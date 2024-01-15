import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BrandingSchema = zod.object({
  name: zod.string().max(30),
  app_handle: zod
    .string()
    .max(256)
    .refine((value) => value && /^\w*(?!-)[a-z0-9-]+(?<!-)$/.test(value))
    .optional(),
})

export const BrandingSpecIdentifier = 'branding'

const spec = createConfigExtensionSpecification({
  identifier: BrandingSpecIdentifier,
  schema: BrandingSchema,
})

export default spec

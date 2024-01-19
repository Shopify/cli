import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const AppExtensionCollectionIdentifier = 'extension_collection'

const AppExtensionCollectionSchema = zod.object({
  extension_collection: zod
    .array(
      zod.object({
        name: zod.string().max(30),
        handle: zod.string(),
        extensions: zod.array(zod.string()),
      }),
    )
    .optional(),
})

const spec = createConfigExtensionSpecification({
  identifier: AppExtensionCollectionIdentifier,
  schema: AppExtensionCollectionSchema,
})

export default spec

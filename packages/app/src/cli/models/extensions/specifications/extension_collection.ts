import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const ExtensionCollectionIdentifier = 'extension_collection'

export const ExtensionCollection = zod.object({
  extensions: zod.array(zod.string()),
  name: zod.string(),
  handle: zod.string(),
})

const ExtensionCollectionSchema = BaseSchema.extend({
  extension_collection: ExtensionCollection.optional(),
})

export interface ExtensionCollection {
  name: string
  handle: string
  extensions: string[]
}

// const spec = createConfigExtensionSpecification({
//   identifier: ExtensionCollectionIdentifier,
//   schema: ExtensionCollectionSchema,
// })

const spec = createExtensionSpecification({
  identifier: 'extension_collection',
  schema: ExtensionCollectionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, directory) => {
    return {
      handle: config.extension_collection?.handle,
      name: config.extension_collection?.name,
      extensions: config.extension_collection?.extensions,
    }
  },
})

export default spec

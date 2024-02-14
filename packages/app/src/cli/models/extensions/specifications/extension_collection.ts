import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const ExtensionCollectionIdentifier = 'extension_collection'

const ExtensionCollectionSchema = BaseSchema.extend({
  extensions: zod.array(zod.string()),
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
      handle: config.handle,
      name: config.name,
      extensions: config.extensions,
    }
  },
})

export default spec

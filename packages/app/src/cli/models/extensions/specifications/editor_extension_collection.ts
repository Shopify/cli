import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

interface IncludeSchema {
  handle: string
}

const IncludeSchema = zod.object({
  handle: zod.string(),
})

const EditorExtensionCollectionSchema = BaseSchema.extend({
  include: zod.array(IncludeSchema).optional(),
  includes: zod.array(zod.string()).optional(),
  type: zod.literal('editor_extension_collection'),
})

const editorExtensionCollectionSpecification = createExtensionSpecification({
  identifier: 'editor_extension_collection',
  schema: EditorExtensionCollectionSchema,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, _) => {
    const includes =
      config.includes?.map((handle) => {
        return {handle}
      }) ?? []
    const include = config.include ?? []
    const inCollection = [...includes, ...include]

    // eslint-disable-next-line no-warning-comments
    // TODO: Validation to check either one of include or includes was defined

    return {
      name: config.name,
      handle: config.handle,
      in_collection: inCollection,
    }
  },
})

export default editorExtensionCollectionSpecification

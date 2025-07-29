import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
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
  name: zod.string(),
  include: zod.array(IncludeSchema).optional(),
  includes: zod.array(zod.string()).optional(),
  type: zod.literal('editor_extension_collection'),
}).transform((data) => {
  const includes =
    data.includes?.map((handle) => {
      return {handle}
    }) ?? []
  const include = data.include ?? []
  return {
    ...data,
    inCollection: [...includes, ...include],
  }
})

export type EditorExtensionCollectionType = zod.infer<typeof EditorExtensionCollectionSchema>

const editorExtensionCollectionSpecification = createExtensionSpecification({
  identifier: 'editor_extension_collection',
  schema: EditorExtensionCollectionSchema,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, directory) => {
    const typedConfig = config as EditorExtensionCollectionType
    return {
      name: typedConfig.name,
      handle: typedConfig.handle,
      in_collection: typedConfig.inCollection,
      localization: await loadLocalesConfig(directory, typedConfig.name ?? ''),
    }
  },
})

export default editorExtensionCollectionSpecification

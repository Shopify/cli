import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {err, ok} from '@shopify/cli-kit/node/result'
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
  validate: async (config, path) => {
    const errors: string[] = []

    if (config.inCollection.length < 2) {
      errors.push(`${config.handle}: This editor extension collection must include at least 2 extensions`)
    }

    if (errors.length > 0) {
      errors.push(`Please check the configuration in ${path}`)
      return err(errors.join('\n\n'))
    }

    return ok({})
  },
  deployConfig: async (config, directory) => {
    return {
      name: config.name,
      handle: config.handle,
      in_collection: config.inCollection,
      localization: await loadLocalesConfig(directory, config.name),
    }
  },
})

export default editorExtensionCollectionSpecification

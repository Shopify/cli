import {err, ok} from '@shopify/cli-kit/node/result'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {BaseConfigType, BaseSchema} from '../schemas.js'
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

export type EditorExtensionCollectionType = zod.infer<typeof EditorExtensionCollectionSchema>

const editorExtensionCollectionSpecification = createExtensionSpecification({
  identifier: 'editor_extension_collection',
  schema: EditorExtensionCollectionSchema,
  appModuleFeatures: (_) => [],
  validate: async (config, path) => {
    const errors: string[] = []
    const inCollection = makeExtensionsInCollection(config)

    if (!config.handle) {
      return err(`Editor extension collection with name ${config.name} must have a handle`)
    }

    if (inCollection.length < 2) {
      errors.push(`There must be at least two extensions in editor extension collection ${config.handle}`)
    }

    if (errors.length > 0) {
      errors.push(`Please check the configuration in ${path}`)
      return err(errors.join('\n\n'))
    }

    return ok({})
  },
  deployConfig: async (config, directory) => {
    const inCollection = makeExtensionsInCollection(config)

    // eslint-disable-next-line no-warning-comments
    // TODO: Validation to check either one of include or includes was defined

    return {
      name: config.name,
      handle: config.handle,
      in_collection: inCollection,
      localization: await loadLocalesConfig(directory, config.name),
    }
  },
})

export function makeExtensionsInCollection(config: EditorExtensionCollectionType) {
  const includes =
    config.includes?.map((handle) => {
      return {handle}
    }) ?? []
  const include = config.include ?? []
  return [...includes, ...include]
}

export default editorExtensionCollectionSpecification

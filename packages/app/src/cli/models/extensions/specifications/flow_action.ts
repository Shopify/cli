import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'

import {zod} from '@shopify/cli-kit/node/schema'

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_action'),
  extension: zod.object({
    type: zod.literal('flow_action'),
    handle: zod.string(),
    runtime_url: zod.string(),
    validation_url: zod.string().optional(),
    custom_configuration_page_url: zod.string().optional(),
    custom_configuration_page_preview_url: zod.string().optional(),
    schema: zod.string().optional(),
    return_type_ref: zod.string().optional(),
  }),
  settings: zod.object({
    fields: zod
      .array(
        zod.object({
          key: zod.string(),
          name: zod.string(),
          description: zod.string().optional(),
          required: zod.boolean(),
          type: zod.string(),
        }),
      )
      .optional(),
  }),
})
/**
 * Loads the schema from the partner defined file.
 */
const loadSchemaPatchFromPath = async (extensionPath: string, patchPath: string | undefined) => {
  if (!patchPath) {
    return ''
  }

  const path = await glob(joinPath(extensionPath, patchPath))

  if (path.length > 1) {
    throw new Error('Multiple files found for schema patch path')
  } else if (path.length === 0) {
    return ''
  }

  return readFile(path[0] as string)
}

/**
 * Extension specification with all properties and methods needed to load a Flow Action.
 */
const flowActionSpecification = createExtensionSpecification({
  identifier: 'flow_action',
  schema: FlowActionExtensionSchema,
  singleEntryPath: false,
  appModuleFeatures: (_) => [],
  deployConfig: async (config, extensionPath) => {
    return {
      handle: config.extension.handle,
      title: config.name,
      description: config.description,
      url: config.extension.runtime_url,
      fields: config.settings.fields,
      validation_url: config.extension.validation_url,
      custom_configuration_page_url: config.extension.custom_configuration_page_url,
      custom_configuration_page_preview_url: config.extension.custom_configuration_page_preview_url,
      schema: config.extension.schema,
      return_type_ref: config.extension.return_type_ref,
    }
  },
})

export default flowActionSpecification

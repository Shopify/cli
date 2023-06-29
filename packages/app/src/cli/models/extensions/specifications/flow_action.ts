import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {
  validateNonCommerceObjectShape,
  startsWithHttps,
  validateCustomConfigurationPageConfig,
} from '../../../services/flow/validation.js'
import {serializeFields} from '../../../services/flow/serializeFields.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'
import {zod} from '@shopify/cli-kit/node/schema'

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_action'),
  extensions: zod
    .array(
      zod.object({
        type: zod.literal('flow_action'),
        runtime_url: zod.string().url().refine(startsWithHttps),
        validation_url: zod.string().url().refine(startsWithHttps).optional(),
        config_page_url: zod.string().url().refine(startsWithHttps).optional(),
        config_page_preview_url: zod.string().url().refine(startsWithHttps).optional(),
        schema: zod.string().optional(),
        return_type_ref: zod.string().optional(),
      }),
    )
    .min(1),
  settings: zod
    .object({
      fields: zod
        .array(
          zod
            .object({
              key: zod.string().optional(),
              name: zod.string().optional(),
              description: zod.string().optional(),
              required: zod.boolean().optional(),
              type: zod.string(),
            })
            .refine((field) => validateNonCommerceObjectShape(field, 'flow_action')),
        )
        .optional(),
    })
    .optional(),
}).refine((config) => {
  const {extensions} = config
  const extension = extensions[0]!

  return validateCustomConfigurationPageConfig(
    extension.config_page_url,
    extension.config_page_preview_url,
    extension.validation_url,
  )
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
    throw new Error('No file found for schema patch path')
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
    const {extensions} = config
    const extension = extensions[0]!

    return {
      title: config.name,
      description: config.description,
      url: extension.runtime_url,
      fields: serializeFields('flow_action', config.settings?.fields),
      validation_url: extension.validation_url,
      custom_configuration_page_url: extension.config_page_url,
      custom_configuration_page_preview_url: extension.config_page_preview_url,
      schema_patch: await loadSchemaPatchFromPath(extensionPath, extension.schema),
      return_type_ref: extension.return_type_ref,
    }
  },
})

export default flowActionSpecification

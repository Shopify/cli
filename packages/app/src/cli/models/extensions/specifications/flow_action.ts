import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {glob, readFile} from '@shopify/cli-kit/node/fs'

import {zod} from '@shopify/cli-kit/node/schema'

const SUPPORTED_COMMERCE_OBJECTS = [
  'customer_reference',
  'order_reference',
  'product_reference',
  'marketing_activity_reference',
  'abandonment_reference',
]

interface ConfigField {
  type: string
  required: boolean
  key?: string | undefined
  name?: string | undefined
  description?: string | undefined
}

const validateCommerceObject = (configField: ConfigField) => {
  if (!SUPPORTED_COMMERCE_OBJECTS.includes(configField.type)) {
    if (!configField.key) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.key'],
          message: 'Key must be speicified for non-commerce object fields',
        },
      ])
    }

    if (!configField.name) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.name'],
          message: 'Name must be speicified for non-commerce object fields',
        },
      ])
    }
  }
}

const FlowActionExtensionSchema = BaseSchema.extend({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.literal('flow_action'),
  extensions: zod
    .array(
      zod.object({
        runtime_url: zod.string(),
        validation_url: zod.string().optional(),
        config_page_url: zod.string().optional(),
        config_page_preview_url: zod.string().optional(),
        schema: zod.string().optional(),
        return_type_ref: zod.string().optional(),
      }),
    )
    .min(1),
  settings: zod.object({
    fields: zod
      .array(
        zod
          .object({
            key: zod.string().optional(),
            name: zod.string().optional(),
            description: zod.string().optional(),
            required: zod.boolean(),
            type: zod.string(),
          })
          .refine(validateCommerceObject),
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
    const {extensions} = config
    const extension = extensions[0]

    return {
      title: config.name,
      description: config.description,
      url: extension?.runtime_url,
      fields: config.settings.fields,
      validation_url: extension?.validation_url,
      custom_configuration_page_url: extension?.config_page_url,
      custom_configuration_page_preview_url: extension?.config_page_preview_url,
      schema: extension?.schema,
      return_type_ref: extension?.return_type_ref,
    }
  },
})

export default flowActionSpecification

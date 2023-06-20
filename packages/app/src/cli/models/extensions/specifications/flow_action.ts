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

  return true
}

const uiTypesMap = new Map<string, string>([
  // not sure about this mapping
  ['boolean', 'checkbox'],
  // no email in https://shopify.dev/docs/apps/custom-data/metafields/types
  ['email', 'email'],
  ['multi_line_text_field', 'text-multi-lines'],
  // this one made most sense to me since the other number has decimals
  ['number_integer', 'number'],
  ['single_line_text_field', 'text-single-line'],
  ['url', 'url'],
])

const serializeConfigField = (field: ConfigField) => {
  const uiType = uiTypesMap.get(field.type)

  return {
    id: field.key,
    name: field.key,
    label: field.name,
    description: field.description,
    required: field.required,
    ui_type: uiType,
  }
}

const serializeCommerceObjectField = (field: ConfigField) => {
  const commerceObject = field.type.replace('_reference', '')

  return {
    ...field,
    id: `${commerceObject}_id`,
    name: `${commerceObject}_id`,
    label: `${commerceObject.charAt(0).toUpperCase() + commerceObject.slice(1)} ID`,
    ui_type: 'commerce-object-id',
  } as ConfigField
}

const serializeFields = (fields?: ConfigField[]) => {
  if (!fields) return []

  const serializedFields = fields.map((field) => {
    if (SUPPORTED_COMMERCE_OBJECTS.includes(field.type)) {
      return serializeCommerceObjectField(field)
    }

    return serializeConfigField(field)
  })

  return serializedFields
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

    console.log({fields: serializeFields(config.settings.fields)})

    return {
      title: config.name,
      description: config.description,
      url: extension?.runtime_url,
      fields: serializeFields(config.settings.fields),
      validation_url: extension?.validation_url,
      custom_configuration_page_url: extension?.config_page_url,
      custom_configuration_page_preview_url: extension?.config_page_preview_url,
      schema: extension?.schema,
      return_type_ref: extension?.return_type_ref,
    }
  },
})

export default flowActionSpecification

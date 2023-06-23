import {zod} from '@shopify/cli-kit/node/schema'

// Metafield-like types for commerce objects
const SUPPORTED_COMMERCE_OBJECTS = {
  customer_reference: 'customer_reference',
  order_reference: 'order_reference',
  product_reference: 'product_reference',
  marketing_activity_reference: 'marketing_activity_reference',
  abandonment_reference: 'abandonment_reference',
}

const TRIGGER_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
]

const ACTION_SUPPORTED_COMMERCE_OBJECTS = [
  SUPPORTED_COMMERCE_OBJECTS.customer_reference,
  SUPPORTED_COMMERCE_OBJECTS.order_reference,
  SUPPORTED_COMMERCE_OBJECTS.product_reference,
  SUPPORTED_COMMERCE_OBJECTS.marketing_activity_reference,
  SUPPORTED_COMMERCE_OBJECTS.abandonment_reference,
]

export interface ConfigField {
  type: string
  required?: boolean
  key?: string
  name?: string
  description?: string
}

interface SerializedField {
  name: string
  label?: string
  description?: string
  required?: boolean
  uiType: string
}

type FlowExtensionTypes = 'flow_action' | 'flow_trigger'

// Mapping of metafield types to Flow's Partner's Dashboard UI types
// Only the `email` type was added since it doesn't exist as a metafield type
// https://shopify.dev/docs/apps/custom-data/metafields/types
const uiTypesMap = new Map<string, string>([
  ['boolean', 'checkbox'],
  ['email', 'email'],
  ['multi_line_text_field', 'text-multi-lines'],
  ['number_integer', 'number'],
  ['single_line_text_field', 'text-single-line'],
  ['url', 'url'],
])

export const serializeConfigField = (field: ConfigField, type: FlowExtensionTypes) => {
  const uiType = uiTypesMap.get(field.type)

  if (typeof field.key !== 'string') {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['settings.fields.key'],
        message: 'Key must be specified for non-commerce object fields',
      },
    ])
  }

  if (!uiType) {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['settings.fields.type'],
        message: `Field type ${field.type} is not supported`,
      },
    ])
  }

  const serializedField: SerializedField = {
    name: field.key,
    description: field.description,
    uiType,
  }

  if (type === 'flow_action') {
    serializedField.label = field.name
    serializedField.required = Boolean(field.required)
  }

  return serializedField
}

export const serializeCommerceObjectField = (field: ConfigField, type: FlowExtensionTypes) => {
  if (type === 'flow_trigger' && !TRIGGER_SUPPORTED_COMMERCE_OBJECTS.includes(field.type)) {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['settings.fields.type'],
        message: `Commerce object ${field.type} is not supported for Flow Triggers`,
      },
    ])
  }

  if (type === 'flow_action' && !ACTION_SUPPORTED_COMMERCE_OBJECTS.includes(field.type)) {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['settings.fields.type'],
        message: `Commerce object ${field.type} is not supported for Flow Actions`,
      },
    ])
  }

  const commerceObject = field.type.replace('_reference', '')

  const serializedField: SerializedField = {
    name: `${commerceObject}_id`,
    uiType: type === 'flow_action' ? 'commerce-object-id' : commerceObject,
  }

  if (type === 'flow_action') {
    serializedField.label = `${commerceObject.charAt(0).toUpperCase() + commerceObject.slice(1)} ID`
    serializedField.required = Boolean(field.required)
  }

  return serializedField
}

export const serializeFields = (type: FlowExtensionTypes, fields?: ConfigField[]) => {
  if (!fields) return []

  const serializedFields = fields.map((field) => {
    if (Object.keys(SUPPORTED_COMMERCE_OBJECTS).includes(field.type)) {
      return serializeCommerceObjectField(field, type)
    }

    return serializeConfigField(field, type)
  })

  return serializedFields
}

export const validateNonCommerceObjectShape = (configField: ConfigField, type: FlowExtensionTypes) => {
  if (!Object.keys(SUPPORTED_COMMERCE_OBJECTS).includes(configField.type)) {
    if (!configField.key) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.key'],
          message: 'Key must be specified for non-commerce object fields',
        },
      ])
    }

    if (!configField.name && type === 'flow_action') {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.name'],
          message: 'Name must be specified for non-commerce object fields',
        },
      ])
    }
  }

  return true
}

export const startsWithHttps = (url: string) => url.startsWith('https://')

export const validateCustomConfigurationPageConfig = (
  configPageUrl?: string,
  configPagePreviewUrl?: string,
  validationUrl?: string,
) => {
  if (configPageUrl || configPagePreviewUrl) {
    if (!configPageUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].config_page_url'],
          message: 'To set a custom configuration page a `config_page_url` must be specified.',
        },
      ])
    }

    if (!configPagePreviewUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].config_page_preview_url'],
          message: 'To set a custom configuration page a `config_page_preview_url` must be specified.',
        },
      ])
    }

    if (!validationUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].validation_url'],
          message: 'To set a custom configuration page a `validation_url` must be specified.',
        },
      ])
    }
  }

  return true
}

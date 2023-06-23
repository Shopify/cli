import {zod} from '@shopify/cli-kit/node/schema'

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

interface ConfigField {
  type: string
  required?: boolean
  key?: string
  name?: string
  description?: string
}

interface SerializedField {
  id: string
  name: string
  label?: string
  description?: string
  required?: boolean
  uiType: string
}

const uiTypesMap = new Map<string, string>([
  // not sure about this mapping seems like the best one of the list
  ['boolean', 'checkbox'],
  // no email in https://shopify.dev/docs/apps/custom-data/metafields/types
  ['email', 'email'],
  ['multi_line_text_field', 'text-multi-lines'],
  // this one made most sense to me since the other number has decimals
  ['number_integer', 'number'],
  ['single_line_text_field', 'text-single-line'],
  ['url', 'url'],
])

const serializeConfigField = (field: ConfigField, type: 'flow_action' | 'flow_trigger') => {
  const uiType = uiTypesMap.get(field.type)

  if (typeof field.key !== 'string') {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['settings.fields.key'],
        message: 'Key must be speicified for non-commerce object fields',
      },
    ])
  }

  const serializedField: SerializedField = {
    id: field.key,
    name: field.key,
    description: field.description,
    uiType: uiType || '',
  }

  if (type === 'flow_action') {
    serializedField.label = field.name
    serializedField.required = Boolean(field.required)
  }

  return serializedField
}

const serializeCommerceObjectField = (field: ConfigField, type: 'flow_action' | 'flow_trigger') => {
  const commerceObject = field.type.replace('_reference', '')

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

  const serializedField: SerializedField = {
    id: `${commerceObject}_id`,
    name: `${commerceObject}_id`,
    uiType: type === 'flow_action' ? 'commerce-object-id' : commerceObject,
  }

  if (type === 'flow_action') {
    serializedField.label = `${commerceObject.charAt(0).toUpperCase() + commerceObject.slice(1)} ID`
  }

  return serializedField
}

export const serializeFields = (type: 'flow_action' | 'flow_trigger', fields?: ConfigField[]) => {
  if (!fields) return []

  const serializedFields = fields.map((field) => {
    if (Object.keys(SUPPORTED_COMMERCE_OBJECTS).includes(field.type)) {
      return serializeCommerceObjectField(field, type)
    }

    return serializeConfigField(field, type)
  })

  return serializedFields
}

export const validateCommerceObject = (configField: ConfigField, type: 'flow_action' | 'flow_trigger') => {
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
          path: ['task.custom_configuration_page_url'],
          message: 'To set a custom configuration page a `custom_configuration_page_url` must be specified.',
        },
      ])
    }

    if (!configPagePreviewUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['task.custom_configuration_page_preview_url'],
          message: 'To set a custom configuration page a `custom_configuration_page_preview_url` must be specified.',
        },
      ])
    }

    if (!validationUrl) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['task.validation_url'],
          message: 'To set a custom configuration page a `validation_url` must be specified.',
        },
      ])
    }
  }

  return true
}

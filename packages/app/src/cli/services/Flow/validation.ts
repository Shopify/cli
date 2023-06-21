import {zod} from '@shopify/cli-kit/node/schema'

// todo: need to do supported commerce objects types PER extension type
const SUPPORTED_COMMERCE_OBJECTS = [
  'customer_reference',
  'order_reference',
  'product_reference',
  'marketing_activity_reference',
  'abandonment_reference',
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
    if (SUPPORTED_COMMERCE_OBJECTS.includes(field.type)) {
      return serializeCommerceObjectField(field, type)
    }

    return serializeConfigField(field, type)
  })

  return serializedFields
}

export const validateCommerceObject = (configField: ConfigField, type: 'flow_action' | 'flow_trigger') => {
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

    if (!configField.name && type === 'flow_action') {
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

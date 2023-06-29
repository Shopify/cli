import {ConfigField, SerializedField, FlowExtensionTypes} from './types.js'
import {
  SUPPORTED_COMMERCE_OBJECTS,
  ACTION_SUPPORTED_COMMERCE_OBJECTS,
  TRIGGER_SUPPORTED_COMMERCE_OBJECTS,
} from './constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'

// Mapping of metafield types to Flow's Partner's Dashboard UI types
// Only the `email` type was added since it doesn't exist as a metafield type
// https://shopify.dev/docs/apps/custom-data/metafields/types
const uiTypesMap = new Map<string, string>([
  ['boolean', 'checkbox'],
  ['email', 'email'],
  ['multi_line_text_field', 'text-multi-line'],
  ['number_integer', 'int'],
  ['number_decimal', 'number'],
  ['single_line_text_field', 'text-single-line'],
  ['url', 'url'],
])

export const serializeConfigField = (field: ConfigField, type: FlowExtensionTypes) => {
  const uiType = uiTypesMap.get(field.type)

  if (typeof field.key !== 'string') {
    throw new AbortError(`key property must be specified for non-commerce object fields in ${JSON.stringify(field)}`)
  }

  if (!uiType) {
    throw new AbortError(`Field type ${field.type} is not supported`)
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
    throw new AbortError(`Commerce object ${field.type} is not supported for Flow Triggers`)
  }

  if (type === 'flow_action' && !ACTION_SUPPORTED_COMMERCE_OBJECTS.includes(field.type)) {
    throw new AbortError(`Commerce object ${field.type} is not supported for Flow Actions`)
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

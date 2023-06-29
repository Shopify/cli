import {ConfigField, SerializedField, FlowExtensionTypes} from './types.js'
import {
  SUPPORTED_COMMERCE_OBJECTS,
  ACTION_SUPPORTED_COMMERCE_OBJECTS,
  TRIGGER_SUPPORTED_COMMERCE_OBJECTS,
  uiTypesMap,
} from './constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {capitalize} from '@shopify/cli-kit/common/string'

const typesToUiTypes = new Map<string, string>(uiTypesMap)

export const serializeConfigField = (field: ConfigField, type: FlowExtensionTypes) => {
  const uiType = typesToUiTypes.get(field.type)

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
    serializedField.required = field.required
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
    description: field.description,
  }

  if (type === 'flow_action') {
    serializedField.label = `${capitalize(commerceObject)} ID`
    serializedField.required = field.required
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

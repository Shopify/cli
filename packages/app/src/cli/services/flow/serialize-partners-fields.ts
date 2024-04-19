import {ConfigField, SerializedField, FlowPartnersExtensionTypes} from './types.js'
import {PARTNERS_COMMERCE_OBJECTS, uiTypesMap} from './constants.js'
import {AbortError} from '@shopify/cli-kit/node/error'

const uiTypesToTypes = new Map<string, string>(uiTypesMap.map((typeMapping) => [typeMapping[1], typeMapping[0]]))

const serializeConfigField = (field: SerializedField, type: FlowPartnersExtensionTypes) => {
  const fieldType = uiTypesToTypes.get(field.uiType)

  if (!fieldType) {
    throw new AbortError(`Field type ${field.uiType} is not supported`)
  }

  const serializedField: ConfigField = {
    key: field.name,
    description: field.description ? field.description : undefined,
    type: fieldType,
  }

  if (type === 'flow_action_definition') {
    serializedField.name = field.label
    serializedField.required = field.required
  }

  return serializedField
}

const serializeCommerceObjectField = (field: SerializedField, type: FlowPartnersExtensionTypes) => {
  const isAction = type === 'flow_action_definition'
  const fieldType = isAction ? `${field.name.replace('_id', '')}_reference` : `${field.uiType}_reference`

  const serializedField: ConfigField = {
    type: fieldType,
  }

  if (type === 'flow_action_definition') {
    serializedField.required = field.required
  }

  return serializedField
}

export const configFromSerializedFields = (type: FlowPartnersExtensionTypes, fields?: SerializedField[]) => {
  if (!fields) return []

  const serializedFields = fields.map((field) => {
    if (field.uiType === 'commerce-object-id' || PARTNERS_COMMERCE_OBJECTS.includes(field.uiType)) {
      return serializeCommerceObjectField(field, type)
    }

    return serializeConfigField(field, type)
  })

  return serializedFields
}

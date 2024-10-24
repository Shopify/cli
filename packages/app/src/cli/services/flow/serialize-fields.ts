import {ConfigField, SerializedField, FlowExtensionTypes} from './types.js'
import {
  SUPPORTED_COMMERCE_OBJECTS,
  ACTION_SUPPORTED_COMMERCE_OBJECTS,
  TRIGGER_SUPPORTED_COMMERCE_OBJECTS,
  actionUiTypesMap,
  triggerUiTypesMap,
} from './constants.js'
import {isSchemaTypeReference} from './validation.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {pascalize} from '@shopify/cli-kit/common/string'

const actionTypesToUiTypes = new Map<string, string>(actionUiTypesMap)
const triggerTypesToUiTypes = new Map<string, string>(triggerUiTypesMap)

export const serializeConfigField = (field: ConfigField, type: FlowExtensionTypes) => {
  const typesToUiTypes = type === 'flow_action' ? actionTypesToUiTypes : triggerTypesToUiTypes
  const typeIsSchemaTypeReference = isSchemaTypeReference(field.type)
  const uiType = typeIsSchemaTypeReference
    ? typesToUiTypes.get('schema_type_reference')
    : typesToUiTypes.get(field.type)

  if (typeof field.key !== 'string') {
    throw new AbortError(`key property must be specified for non-commerce object fields in ${JSON.stringify(field)}`)
  }

  if (!uiType) {
    throw new AbortError(
      `Field type ${field.type} is not supported on Flow ${type === 'flow_action' ? 'Actions' : 'Triggers'}`,
    )
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

  if (typeIsSchemaTypeReference) {
    serializedField.typeRefName = field.type.replace('schema.', '')
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
  if (commerceObject === 'marketing_activity') {
    serializedField.uiType = 'marketing-activity-id'
  }

  if (type === 'flow_action') {
    serializedField.label = `${pascalize(commerceObject)} ID`
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

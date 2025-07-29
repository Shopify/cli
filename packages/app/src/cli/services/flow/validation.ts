import {ConfigField, FlowExtensionTypes} from './types.js'
import {SUPPORTED_COMMERCE_OBJECTS} from './constants.js'
import {FlowTriggerSettingsSchema} from '../../models/extensions/specifications/flow_trigger.js'
import {zod} from '@shopify/cli-kit/node/schema'

function fieldValidationErrorMessage(property: string, configField: ConfigField, handle: string, index: number) {
  return `'${property}' property must be a string for 'field[${index}]' ${JSON.stringify(
    configField,
  )} of flow extension '${handle}'`
}

const baseFieldSchema = zod
  .object({
    type: zod.string(),
    description: zod.string().optional(),
  })
  .strict()

export const validateFieldShape = (
  configField: ConfigField,
  type: FlowExtensionTypes,
  extensionHandle: string,
  index: number,
): ConfigField => {
  const isCommerceObjectField = Object.keys(SUPPORTED_COMMERCE_OBJECTS).includes(configField.type)

  if (!isCommerceObjectField) {
    if (type === 'flow_action') {
      try {
        return baseFieldSchema
          .extend({
            key: zod.string(),
            name: zod.string(),
            required: zod.boolean().optional(),
          })
          .parse(configField)
      } catch (error) {
        if (error instanceof zod.ZodError) {
          const issue = error.issues[0]
          if (issue.path[0] === 'key' && issue.code === 'invalid_type') {
            throw new Error(fieldValidationErrorMessage('key', configField, extensionHandle, index))
          }
          if (issue.path[0] === 'name' && issue.code === 'invalid_type') {
            throw new Error(fieldValidationErrorMessage('name', configField, extensionHandle, index))
          }
          throw new Error(issue.message)
        }
        throw error
      }
    } else {
      try {
        return FlowTriggerSettingsSchema.parse(configField)
      } catch (error) {
        if (error instanceof zod.ZodError) {
          throw new Error(error.issues[0].message)
        }
        throw error
      }
    }
  }

  if (isCommerceObjectField) {
    try {
      return baseFieldSchema
        .extend({
          required: zod.boolean().optional(),
          marketingActivityCreateUrl: zod.string().optional(),
          marketingActivityDeleteUrl: zod.string().optional(),
        })
        .parse(configField)
    } catch (error) {
      if (error instanceof zod.ZodError) {
        const issue = error.issues[0]
        if (issue.code === 'unrecognized_keys') {
          const keys = (issue as any).keys || []
          throw new Error(`Unrecognized key(s) in object: '${keys.join("', '")}'`)
        }
        throw new Error(issue.message)
      }
      throw error
    }
  }

  try {
    return baseFieldSchema.parse(configField)
  } catch (error) {
    if (error instanceof zod.ZodError) {
      throw new Error(error.issues[0].message)
    }
    throw error
  }
}

export const startsWithHttps = (url: string) => url.startsWith('https://')

export const isSchemaTypeReference = (type: string) => type.startsWith('schema.')

export const validateCustomConfigurationPageConfig = (
  configPageUrl?: string,
  configPagePreviewUrl?: string,
  validationUrl?: string,
) => {
  if (configPageUrl || configPagePreviewUrl) {
    if (!configPageUrl) {
      throw new Error('To set a custom configuration page a `config_page_url` must be specified.')
    }

    if (!configPagePreviewUrl) {
      throw new Error('To set a custom configuration page a `config_page_preview_url` must be specified.')
    }

    if (!validationUrl) {
      throw new Error('To set a custom configuration page a `validation_url` must be specified.')
    }
  }

  return true
}

export const validateTriggerSchemaPresence = (fields: ConfigField[], schema?: string) => {
  if (fields.some((field) => isSchemaTypeReference(field.type)) && !schema) {
    throw new Error('To reference schema types a `schema` must be specified.')
  }

  return true
}

export const validateReturnTypeConfig = (returnTypeRef?: string, schema?: string) => {
  if (returnTypeRef || schema) {
    if (!returnTypeRef) {
      throw new Error('When uploading a schema a `return_type_ref` must be specified.')
    }

    if (!schema) {
      throw new Error('To set a return type a `schema` must be specified.')
    }
  }

  return true
}

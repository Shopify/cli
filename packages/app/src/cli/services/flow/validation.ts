import {ConfigField, FlowExtensionTypes} from './types.js'
import {SUPPORTED_COMMERCE_OBJECTS} from './constants.js'
import {FlowTriggerSettingsSchema} from '../../models/extensions/specifications/flow_trigger.js'
import {zod} from '@shopify/cli-kit/node/schema'

function fieldValidationErrorMessage(property: string, configField: ConfigField, handle: string, index: number) {
  const errorMessage = `'${property}' property must be a string for 'field[${index}]' ${JSON.stringify(
    configField,
  )} of flow extension '${handle}'`

  return {required_error: errorMessage, invalid_type_error: errorMessage}
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
      return baseFieldSchema
        .extend({
          key: zod.string(fieldValidationErrorMessage('key', configField, extensionHandle, index)),
          name: zod.string(fieldValidationErrorMessage('name', configField, extensionHandle, index)),
          required: zod.boolean().optional(),
        })
        .parse(configField)
    } else {
      return FlowTriggerSettingsSchema.parse(configField)
    }
  }

  if (isCommerceObjectField) {
    return baseFieldSchema
      .extend({
        required: zod.boolean().optional(),
        marketingActivityCreateUrl: zod.string().optional(),
        marketingActivityDeleteUrl: zod.string().optional(),
      })
      .parse(configField)
  }

  return baseFieldSchema.parse(configField)
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

export const validateTriggerSchemaPresence = (fields: ConfigField[], schema?: string) => {
  if (fields.some((field) => isSchemaTypeReference(field.type)) && !schema) {
    throw new zod.ZodError([
      {
        code: zod.ZodIssueCode.custom,
        path: ['extensions[0].schema'],
        message: 'To reference schema types a `schema` must be specified.',
      },
    ])
  }

  return true
}

export const validateReturnTypeConfig = (returnTypeRef?: string, schema?: string) => {
  if (returnTypeRef || schema) {
    if (!returnTypeRef) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].return_type_ref'],
          message: 'When uploading a schema a `return_type_ref` must be specified.',
        },
      ])
    }

    if (!schema) {
      throw new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].schema'],
          message: 'To set a return type a `schema` must be specified.',
        },
      ])
    }
  }

  return true
}

import {ConfigField, FlowExtensionTypes} from './types.js'
import {SUPPORTED_COMMERCE_OBJECTS} from './constants.js'
import {zod} from '@shopify/cli-kit/node/schema'

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

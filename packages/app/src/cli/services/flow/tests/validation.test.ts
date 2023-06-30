import {ConfigField} from '../types.js'
import {validateNonCommerceObjectShape, validateCustomConfigurationPageConfig} from '../validation.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

describe('validateNonCommerceObjectShape', () => {
  test('should return true when non-commerce object field has valid shape', () => {
    // given
    const nonCommerceObjectField: ConfigField = {
      type: 'multi_line_text_field',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const result = validateNonCommerceObjectShape(nonCommerceObjectField, 'flow_action')

    // then
    expect(result).toBe(true)
  })

  test('should return true when field is a commerce object', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'product_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const result = validateNonCommerceObjectShape(commerceObjectField, 'flow_action')

    // then
    expect(result).toBe(true)
  })

  test('should throw an error if key is not specified for non-commerce object field', () => {
    // given
    const invalidField: ConfigField = {
      type: 'string',
      key: undefined,
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateNonCommerceObjectShape(invalidField, 'flow_action')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.key'],
          message: 'Key must be specified for non-commerce object fields',
        },
      ]),
    )
  })

  test('should throw an error if name is not specified for non-commerce object field in flow action', () => {
    // given
    const invalidField: ConfigField = {
      type: 'string',
      key: 'my-field',
      name: undefined,
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateNonCommerceObjectShape(invalidField, 'flow_action')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.name'],
          message: 'Name must be specified for non-commerce object fields',
        },
      ]),
    )
  })
})

describe('validateCustomConfigurationPageConfig', () => {
  test('should return true if no custom configuration page properties are specified', () => {
    // when
    const result = validateCustomConfigurationPageConfig()

    // then
    expect(result).toBe(true)
  })

  test('should throw an error if config page URL is missing but a preview url is provided', () => {
    // given
    const configPageUrl = undefined
    const configPagePreviewUrl = 'preview-url'
    const validationUrl = 'validation-url'

    // then
    expect(() =>
      validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, validationUrl),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].config_page_url'],
          message: 'To set a custom configuration page a `config_page_url` must be specified.',
        },
      ]),
    )
  })

  test('should throw an error if config page preview URL is missing but a config page url is provided', () => {
    // given
    const configPageUrl = 'config-url'
    const configPagePreviewUrl = undefined
    const validationUrl = 'validation-url'

    // then
    expect(() =>
      validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, validationUrl),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].config_page_preview_url'],
          message: 'To set a custom configuration page a `config_page_preview_url` must be specified.',
        },
      ]),
    )
  })

  test('should throw an error if validation URL is missing when both a config page and preview urls are provided', () => {
    // given
    const configPageUrl = 'config-url'
    const configPagePreviewUrl = 'preview-url'
    const validationUrl = undefined

    // then
    expect(() =>
      validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, validationUrl),
    ).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['extensions[0].validation_url'],
          message: 'To set a custom configuration page a `validation_url` must be specified.',
        },
      ]),
    )
  })

  test('should return true if all custom configuration page URLs are specified', () => {
    // given
    const configPageUrl = 'config-url'
    const configPagePreviewUrl = 'preview-url'
    const validationUrl = 'validation-url'

    // when
    const result = validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, validationUrl)

    // then
    expect(result).toBe(true)
  })
})

import {validateFieldShape, validateCustomConfigurationPageConfig, validateReturnTypeConfig} from './validation.js'
import {ConfigField} from './types.js'
import {describe, expect, test} from 'vitest'

describe('validateFieldShape', () => {
  test('should return true when non-commerce object field has valid shape and is flow action', () => {
    // given
    const nonCommerceObjectField: ConfigField = {
      type: 'multi_line_text_field',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateFieldShape(nonCommerceObjectField, 'flow_action', 'handle', 0)).not.toThrow()
  })

  test('should return true when non-commerce object field has valid shape and is flow trigger', () => {
    // given
    const nonCommerceObjectField: ConfigField = {
      type: 'multi_line_text_field',
      key: 'my field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateFieldShape(nonCommerceObjectField, 'flow_trigger', 'handle', 0)).not.toThrow()
  })

  test('should return true when field is a commerce object and is flow action', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'product_reference',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateFieldShape(commerceObjectField, 'flow_action', 'handle', 0)).not.toThrow()
  })

  test('should return true when field is a commerce object and is flow trigger', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'product_reference',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => validateFieldShape(commerceObjectField, 'flow_trigger', 'handle', 0)).not.toThrow()
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
    const message = `'key' property must be a string for 'field[0]' ${JSON.stringify(
      invalidField,
    )} of flow extension 'handle'`.replace(/"/g, '\\"')
    expect(() => validateFieldShape(invalidField, 'flow_action', 'handle', 0)).toThrow(message)
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
    const message = `'name' property must be a string for 'field[0]' ${JSON.stringify(
      invalidField,
    )} of flow extension 'handle'`.replace(/"/g, '\\"')
    expect(() => validateFieldShape(invalidField, 'flow_action', 'handle', 0)).toThrow(message)
  })

  test('should throw an error if key non alpha or space chars for non-commerce object field in flow trigger', () => {
    // given
    const invalidField: ConfigField = {
      type: 'string',
      key: 'my-field',
      description: 'This is my field',
      required: true,
    }

    // then
    const message = 'String must contain only alphabetic characters and spaces'
    expect(() => validateFieldShape(invalidField, 'flow_trigger', 'handle', 0)).toThrow(message)
  })

  test('should throw an error if key specified for a commerce object field', () => {
    // given
    const invalidField: ConfigField = {
      type: 'customer_reference',
      key: 'foo',
      description: 'This is my field',
    }

    // then
    const message = "Unrecognized key(s) in object: 'key'"
    expect(() => validateFieldShape(invalidField, 'flow_action', 'handle', 0)).toThrow(message)
  })

  test('should throw an error if name a commerce object field in flow action', () => {
    // given
    const invalidField: ConfigField = {
      type: 'customer_reference',
      name: 'A name for my field',
      description: 'This is my field',
      required: true,
    }

    // then
    const message = "Unrecognized key(s) in object: 'name'"
    expect(() => validateFieldShape(invalidField, 'flow_action', 'handle', 0)).toThrow(message)
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
    // Given
    const configPageUrl = undefined
    const configPagePreviewUrl = 'https://test.com'

    // Then
    expect(() => validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, undefined)).toThrow(
      'To set a custom configuration page a `config_page_url` must be specified',
    )
  })

  test('should throw an error if config page preview URL is missing but a config page url is provided', () => {
    // Given
    const configPageUrl = 'https://test.com'
    const configPagePreviewUrl = undefined

    // Then
    expect(() => validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, undefined)).toThrow(
      'To set a custom configuration page a `config_page_preview_url` must be specified',
    )
  })

  test('should throw an error if validation URL is missing when both a config page and preview urls are provided', () => {
    // Given
    const configPageUrl = 'https://test.com'
    const configPagePreviewUrl = 'https://test.com'

    // Then
    expect(() => validateCustomConfigurationPageConfig(configPageUrl, configPagePreviewUrl, undefined)).toThrow(
      'To set a custom configuration page a `validation_url` must be specified',
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

describe('validateReturnTypeConfig', () => {
  test('should return true when both returnTypeRef and schema are provided', () => {
    const result = validateReturnTypeConfig('returnTypeRefValue', 'schemaValue')
    expect(result).toBe(true)
  })

  test('should throw ZodError when returnTypeRef is missing', () => {
    expect(() => {
      validateReturnTypeConfig(undefined, 'schemaValue')
    }).toThrow('When uploading a schema a `return_type_ref` must be specified')
  })

  test('should throw ZodError when schema is missing', () => {
    expect(() => {
      validateReturnTypeConfig('returnTypeRefValue', undefined)
    }).toThrow('To set a return type a `schema` must be specified')
  })

  test('should return true when neither returnTypeRef nor schema are provided', () => {
    const result = validateReturnTypeConfig()
    expect(result).toBe(true)
  })
})

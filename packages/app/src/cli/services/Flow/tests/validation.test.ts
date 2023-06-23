import {
  serializeConfigField,
  serializeCommerceObjectField,
  validateNonCommerceObjectShape,
  ConfigField,
  validateCustomConfigurationPageConfig,
} from '../validation.js'
import {describe, expect, test} from 'vitest'
import {zod} from '@shopify/cli-kit/node/schema'

describe('serializeConfigField', () => {
  const field: ConfigField = {
    type: 'single_line_text_field',
    key: 'my-field',
    name: 'My Field',
    description: 'This is my field',
    required: true,
  }

  test('should serialize a field for a flow action', () => {
    const serializedField = serializeConfigField(field, 'flow_action')

    expect(serializedField).toEqual({
      name: 'my-field',
      description: 'This is my field',
      uiType: 'text-single-line',
      label: 'My Field',
      required: true,
    })
  })

  test('should serialize a field for a flow trigger', () => {
    const serializedField = serializeConfigField(field, 'flow_trigger')

    expect(serializedField).toEqual({
      name: 'my-field',
      description: 'This is my field',
      uiType: 'text-single-line',
    })
  })

  test('should throw an error if key is not a string', () => {
    const invalidField: ConfigField = {
      type: 'string',
      key: undefined,
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    expect(() => serializeConfigField(invalidField, 'flow_action')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.key'],
          message: 'Key must be specified for non-commerce object fields',
        },
      ]),
    )
  })

  test('should throw an error if field type is not supported', () => {
    const invalidField: ConfigField = {
      type: 'invalid-type',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    expect(() => serializeConfigField(invalidField, 'flow_action')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.type'],
          message: 'Field type invalid-type is not supported',
        },
      ]),
    )
  })
})

describe('serializeCommerceObjectField', () => {
  const commerceObjectField: ConfigField = {
    type: 'product_reference',
    key: 'my-field',
    name: 'My Field',
    description: 'This is my field',
    required: true,
  }

  test('should serialize a commerce object field for a flow action', () => {
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_action')

    expect(serializedField).toEqual({
      name: 'product_id',
      uiType: 'commerce-object-id',
      label: 'Product ID',
      required: true,
    })
  })

  test('should serialize a commerce object field for a flow trigger', () => {
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_trigger')

    expect(serializedField).toEqual({
      name: 'product_id',
      uiType: 'product',
    })
  })

  test('should throw an error if commerce object is not supported for flow trigger', () => {
    const invalidField: ConfigField = {
      type: 'invalid_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    expect(() => serializeCommerceObjectField(invalidField, 'flow_trigger')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.type'],
          message: 'Commerce object invalid_reference is not supported for Flow Triggers',
        },
      ]),
    )
  })

  test('should throw an error if commerce object is not supported for flow action', () => {
    const invalidField: ConfigField = {
      type: 'invalid_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    expect(() => serializeCommerceObjectField(invalidField, 'flow_action')).toThrowError(
      new zod.ZodError([
        {
          code: zod.ZodIssueCode.custom,
          path: ['settings.fields.type'],
          message: 'Commerce object invalid_reference is not supported for Flow Actions',
        },
      ]),
    )
  })
})

describe('validateNonCommerceObjectShape', () => {
  const commerceObjectField: ConfigField = {
    type: 'product_reference',
    key: 'my-field',
    name: 'My Field',
    description: 'This is my field',
    required: true,
  }

  const nonCommerceObjectField: ConfigField = {
    type: 'multi_line_text_field',
    key: 'my-field',
    name: 'My Field',
    description: 'This is my field',
    required: true,
  }

  test('should return true when non-commerce object field has valid shape', () => {
    const result = validateNonCommerceObjectShape(nonCommerceObjectField, 'flow_action')

    expect(result).toBe(true)
  })

  test('should return true when field is a commerce object', () => {
    const result = validateNonCommerceObjectShape(commerceObjectField, 'flow_action')

    expect(result).toBe(true)
  })

  test('should throw an error if key is not specified for non-commerce object field', () => {
    const invalidField: ConfigField = {
      type: 'string',
      key: undefined,
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

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
    const invalidField: ConfigField = {
      type: 'string',
      key: 'my-field',
      name: undefined,
      description: 'This is my field',
      required: true,
    }

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
    const result = validateCustomConfigurationPageConfig()

    expect(result).toBe(true)
  })

  test('should throw an error if config page URL is missing but a preview url is provided', () => {
    expect(() => validateCustomConfigurationPageConfig(undefined, 'preview-url', 'validation-url')).toThrowError(
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
    expect(() => validateCustomConfigurationPageConfig('config-url', undefined, 'validation-url')).toThrowError(
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
    expect(() => validateCustomConfigurationPageConfig('config-url', 'preview-url', undefined)).toThrowError(
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
    const result = validateCustomConfigurationPageConfig('config-url', 'preview-url', 'validation-url')

    expect(result).toBe(true)
  })
})

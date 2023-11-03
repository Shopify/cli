import {ConfigField} from './types.js'
import {serializeConfigField, serializeCommerceObjectField} from './serialize-fields.js'
import {describe, expect, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('serializeConfigField', () => {
  test('should serialize a field for a flow action', () => {
    // given
    const field: ConfigField = {
      type: 'multi_line_text_field',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeConfigField(field, 'flow_action')

    // then
    expect(serializedField).toEqual({
      name: 'my-field',
      description: 'This is my field',
      uiType: 'text-multi-line',
      label: 'My Field',
      required: true,
    })
  })

  test('should serialize a field for a flow trigger', () => {
    // given
    const field: ConfigField = {
      type: 'single_line_text_field',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeConfigField(field, 'flow_trigger')

    // then
    expect(serializedField).toEqual({
      name: 'my-field',
      description: 'This is my field',
      uiType: 'text-single-line',
    })
  })

  test('should throw an error if key is not a string', () => {
    // given
    const invalidField: ConfigField = {
      type: 'string',
      key: undefined,
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => serializeConfigField(invalidField, 'flow_action')).toThrowError(
      new AbortError(
        'key property must be specified for non-commerce object fields in {"type":"string","name":"My Field","description":"This is my field","required":true}',
      ),
    )
  })

  test('should throw an error if field type is not supported', () => {
    // given
    const invalidField: ConfigField = {
      // multi_line_text_field is invalid on triggers
      type: 'multi_line_text_field',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => serializeConfigField(invalidField, 'flow_trigger')).toThrowError(
      new AbortError('Field type multi_line_text_field is not supported on Flow Triggers'),
    )
  })
})

describe('serializeCommerceObjectField', () => {
  test('should serialize a commerce object field for a flow action', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'product_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_action')

    // then
    expect(serializedField).toEqual({
      name: 'product_id',
      uiType: 'commerce-object-id',
      label: 'Product ID',
      description: 'This is my field',
      required: true,
    })
  })

  test('should serialize a company contact commerce object field for a flow action', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'company_contact_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_action')

    // then
    expect(serializedField).toEqual({
      name: 'company_contact_id',
      uiType: 'commerce-object-id',
      label: 'CompanyContact ID',
      description: 'This is my field',
      required: true,
    })
  })

  test('should serialize a commerce object field for a flow trigger', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'product_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_trigger')

    // then
    expect(serializedField).toEqual({
      name: 'product_id',
      uiType: 'product',
      description: 'This is my field',
    })
  })

  test('should serialize a company contact commerce object field for a flow trigger', () => {
    // given
    const commerceObjectField: ConfigField = {
      type: 'company_contact_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // when
    const serializedField = serializeCommerceObjectField(commerceObjectField, 'flow_trigger')

    // then
    expect(serializedField).toEqual({
      name: 'company_contact_id',
      uiType: 'company_contact',
      description: 'This is my field',
    })
  })

  test('should throw an error if commerce object is not supported for flow trigger', () => {
    // given
    const invalidField: ConfigField = {
      type: 'invalid_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => serializeCommerceObjectField(invalidField, 'flow_trigger')).toThrowError(
      new AbortError('Commerce object invalid_reference is not supported for Flow Triggers'),
    )
  })

  test('should throw an error if commerce object is not supported for flow action', () => {
    // given
    const invalidField: ConfigField = {
      type: 'invalid_reference',
      key: 'my-field',
      name: 'My Field',
      description: 'This is my field',
      required: true,
    }

    // then
    expect(() => serializeCommerceObjectField(invalidField, 'flow_action')).toThrowError(
      new AbortError('Commerce object invalid_reference is not supported for Flow Actions'),
    )
  })
})

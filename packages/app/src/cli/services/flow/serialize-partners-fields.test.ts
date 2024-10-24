import {serializeFields} from './serialize-fields.js'
import {configFromSerializedFields} from './serialize-partners-fields.js'
import {SerializedField} from './types.js'
import {describe, expect, test} from 'vitest'

describe('serialize-fields', () => {
  test('serializing and deserialize fields for flow_action should be the same', () => {
    // Given
    const fields: SerializedField[] = [
      {
        name: 'customer_id',
        label: 'Customer ID',
        required: true,
        uiType: 'commerce-object-id',
      },
      {
        name: 'product_id',
        label: 'Product ID',
        required: true,
        uiType: 'commerce-object-id',
      },
      {
        name: 'marketing_activity_id',
        label: 'MarketingActivity ID',
        required: false,
        uiType: 'marketing-activity-id',
      },
      {
        name: 'email field',
        label: 'email label',
        description: 'email help',
        required: false,
        uiType: 'email',
      },
      {
        name: 'number name',
        label: 'number label',
        description: 'number help',
        required: true,
        uiType: 'number',
      },
    ]

    // When
    const configFields = configFromSerializedFields('flow_action_definition', fields)
    const reSerializedFields = serializeFields('flow_action', configFields)

    // Then
    expect(reSerializedFields).toEqual(fields)
  })

  test('serializing and deserialize fields for flow_trigger should be the same', () => {
    // Given
    const fields: SerializedField[] = [
      {
        name: 'customer_id',
        uiType: 'customer',
      },
      {
        description: 'number description',
        name: 'number property',
        uiType: 'number',
      },
      {
        description: 'email description',
        name: 'email name',
        uiType: 'email',
      },
    ]

    // When
    const configFields = configFromSerializedFields('flow_trigger_definition', fields)
    const reSerializedFields = serializeFields('flow_trigger', configFields)

    // Then
    expect(reSerializedFields).toEqual(fields)
  })
})

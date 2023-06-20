import {getTriggerPreview, getActionPreview} from './preview.js'
import {describe, expect, test} from 'vitest'

describe('getTriggerPreview', () => {
  test('generates a valid GraphQL payload', () => {
    const payload = getTriggerPreview('123abc', [
      {
        name: 'my_field',
        id: 'my_field',
        uiType: 'text',
      },
      {
        name: 'customer_id',
        id: 'customer_id',
        uiType: 'customer',
      },
    ])

    expect(payload).toContain('trigger_id: "123abc"')
    expect(payload).toContain('properties: {"my_field":"","customer_id":"gid://shopify/Customer/1234567"}')
  })
})

describe('getActionPreview', () => {
  test('generates a valid json payload', () => {
    const payload = getActionPreview('abc123', false, [
      {
        name: 'my_field',
        label: 'My Field',
        id: 'my_field',
        description: 'My Field Description',
        uiType: 'text',
        required: false,
      },
      {
        name: 'customer_id',
        label: 'Customer ID',
        id: 'customer_id',
        description: 'Customer ID Description',
        uiType: 'customer',
        required: true,
      },
    ])

    const parsedPayload = JSON.parse(payload)

    expect(parsedPayload.action_definition_id).toBe('abc123')
    expect(parsedPayload.properties).toEqual({my_field: '', customer_id: 'gid://shopify/Customer/1234567'})
    expect(parsedPayload.step_reference).toBeFalsy()
  })

  test('generates a valid json payload when there is a custom configuration page url', () => {
    const payload = getActionPreview('abc123', true, [
      {
        name: 'my_field',
        label: 'My Field',
        id: 'my_field',
        description: 'My Field Description',
        uiType: 'text',
        required: false,
      },
      {
        name: 'customer_id',
        label: 'Customer ID',
        id: 'customer_id',
        description: 'Customer ID Description',
        uiType: 'customer',
        required: true,
      },
    ])

    const parsedPayload = JSON.parse(payload)

    expect(parsedPayload.action_definition_id).toBe('abc123')
    expect(parsedPayload.properties).toEqual({my_field: '', customer_id: 'gid://shopify/Customer/1234567'})
    expect(parsedPayload.step_reference).toBeTruthy()
  })
})

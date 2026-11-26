import {themeConsoleJsonOutputSchema} from './types.js'
import {expect, test} from 'vitest'
import {jsonSchemaValidate} from '@shopify/cli-kit/node/json-schema'

test('the discoverable JSON Schema validates native values, failures and skipped inputs', () => {
  const schema = themeConsoleJsonOutputSchema.jsonSchema
  const result = {
    status: 'partial',
    results: [
      {input: 'shop', status: 'success', value: {native_key: [false, null, 0, 'value']}},
      {input: 'invalid', status: 'failed', error: {type: 'abort', message: 'Invalid command'}},
      {input: 'shop.name', status: 'skipped', reason: 'previous-input-failed'},
    ],
  }

  expect(jsonSchemaValidate(result, schema, 'fail').state).toBe('ok')
  expect(jsonSchemaValidate({environments: [{environment: 'development', result}]}, schema, 'fail').state).toBe('ok')
  expect(() =>
    themeConsoleJsonOutputSchema.validate({status: 'success', results: [{input: 'shop.name', status: 'success'}]}),
  ).toThrow()
  expect(() => themeConsoleJsonOutputSchema.validate({...result, extra: true})).toThrow()
})

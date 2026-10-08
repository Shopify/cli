import {bulkOperationStatusJsonOutputSchema, cancelBulkOperationJsonOutputSchema} from './types.js'
import {toBulkOperationJson} from './json.js'
import {testBulkOperation} from './bulk-operation.test-data.js'
import {expect, test} from 'vitest'

test('status result rejects unselected fields and lists without pagination metadata', () => {
  const context = {storeDomain: 'shop.myshopify.com', apiVersion: '2026-01'}
  const value = {
    ...context,
    operationGid: 'gid://shopify/BulkOperation/123',
    operation: toBulkOperationJson(testBulkOperation()),
  }
  expect(() => bulkOperationStatusJsonOutputSchema.validate({...value, token: 'secret'})).toThrow()
  expect(() => bulkOperationStatusJsonOutputSchema.validate({...context, operations: []})).toThrow()
  expect(bulkOperationStatusJsonOutputSchema.jsonSchema.definitions?.BulkOperation).toBeDefined()
})

test.each([{name: 'cancel', schema: cancelBulkOperationJsonOutputSchema}])(
  '$name uses the common operation projection',
  ({schema}) => {
    const value = {
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      status: 'success' as const,
      operation: toBulkOperationJson(testBulkOperation()),
    }
    expect(JSON.parse(schema.encode(value))).toEqual(value)
  },
)

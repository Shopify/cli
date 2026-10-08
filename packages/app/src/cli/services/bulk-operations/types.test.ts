import {bulkOperationStatusJsonOutputSchema} from './types.js'
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

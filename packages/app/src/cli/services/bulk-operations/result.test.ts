import {testBulkOperation} from './bulk-operation.test-data.js'
import {renderBulkOperationStatusResult} from './status-result.js'
import {expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

test('does not invent a list operation type or claim completeness for a capped list', () => {
  const output = mockAndCaptureOutput()
  const {type: _type, ...operation} = testBulkOperation()
  renderBulkOperationStatusResult({operations: Array.from({length: 100}, () => operation)}, 'json')
  const result = JSON.parse(output.output())
  expect(result.operations[0]).not.toHaveProperty('type')
  expect(result.operations[0].gid).toBe(operation.id)
  expect(result.pageInfo).toEqual({hasNextPage: null})
})

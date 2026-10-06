import {testBulkOperation} from './bulk-operation.test-data.js'
import {renderCancelBulkOperationResult} from './cancel-result.js'
import {renderBulkOperationStatusResult} from './status-result.js'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {renderSuccess, renderError, renderTable, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')

const originalExitCode = process.exitCode

beforeEach(() => {
  mockAndCaptureOutput().clear()
})

afterEach(() => {
  process.exitCode = originalExitCode
})

function completedResult() {
  return {
    operation: testBulkOperation({status: 'COMPLETED', completedAt: '2026-09-01T00:01:00Z', url: 'https://example.com/results.jsonl'}),
  }
}

test('outputs successful cancellation with the same operation projection', () => {
  const output = mockAndCaptureOutput()
  renderCancelBulkOperationResult(
    {operation: completedResult().operation, userErrors: []},
    'gid://shopify/BulkOperation/123',
    'json',
  )
  expect(JSON.parse(output.output())).toEqual({
    storeDomain: null,
    apiVersion: null,
    status: 'success',
    operation: expectedOperation(),
  })
  expect(renderWarning).not.toHaveBeenCalled()
})

test('routes cancellation user errors through the global fatal-error path', () => {
  expect(() =>
    renderCancelBulkOperationResult(
      {operation: null, userErrors: [{message: 'Cannot cancel'}]},
      'gid://shopify/BulkOperation/123',
      'json',
    ),
  ).toThrow(AbortError)
  expect(mockAndCaptureOutput().output()).toBe('')
})

test('does not invent a list operation type or claim completeness for a capped list', () => {
  const output = mockAndCaptureOutput()
  const {type: _type, ...operation} = completedResult().operation!
  renderBulkOperationStatusResult({operations: Array.from({length: 100}, () => operation)}, 'json')
  const result = JSON.parse(output.output())
  expect(result.operations[0]).not.toHaveProperty('type')
  expect(result.operations[0].gid).toBe(operation.id)
  expect(result.pageInfo).toEqual({hasNextPage: null})
})

test('keeps missing cancellation nonfatal in text mode', () => {
  renderCancelBulkOperationResult({operation: null, userErrors: []}, '123', 'text')
  expect(renderError).toHaveBeenCalledWith(expect.objectContaining({headline: 'Bulk operation not found or could not be canceled.'}))
  expect(process.exitCode).toBe(originalExitCode)
})

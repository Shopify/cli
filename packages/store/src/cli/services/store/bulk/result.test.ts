import {renderExecuteBulkOperationResult} from './execute-result.js'
import {renderCancelBulkOperationResult} from './cancel-result.js'
import {renderBulkOperationStatusResult} from './status-result.js'
import {logBulkOperationStart} from './progress.js'
import {
  executeBulkOperationJsonOutputSchema,
  cancelBulkOperationJsonOutputSchema,
  bulkOperationStatusJsonOutputSchema,
} from './types.js'
import {beforeEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderInfo, renderSuccess, renderWarning, renderError, renderTable} from '@shopify/cli-kit/node/ui'
import {BugError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import type {ExecuteBulkOperationResult} from './types.js'

vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => {
  mockAndCaptureOutput().clear()
})

function completedResult(): ExecuteBulkOperationResult {
  return {
    store: 'shop.myshopify.com',
    apiVersion: '2026-01',
    operation: {
      id: 'gid://shopify/BulkOperation/123',
      type: 'QUERY',
      status: 'COMPLETED',
      objectCount: '2',
      createdAt: '2026-09-01T00:00:00Z',
      completedAt: '2026-09-01T00:01:00Z',
      errorCode: null,
      url: 'https://example.com/results.jsonl',
      partialDataUrl: null,
    },
    userErrors: [],
    watchAborted: false,
    results: '{"id":"1"}\n{"id":"2"}\n',
  }
}

test('preserves raw counts, nullable fields, and omitted fields through encoding', () => {
  const result = completedResult()
  const {completedAt: _completedAt, ...operation} = result.operation!
  const encoded = JSON.parse(executeBulkOperationJsonOutputSchema.encode({...result, operation}))
  expect(encoded.operation.objectCount).toBe('2')
  expect(encoded.operation.errorCode).toBeNull()
  expect(encoded.operation).not.toHaveProperty('completedAt')
  expect(encoded).not.toHaveProperty('outputFile')
  expect(encoded.results).toBe(result.results)
})

test.each([{status: 'INVALID'}, {type: 'INVALID'}, {objectCount: false}, {createdAt: 123}])(
  'rejects an invalid operation field: %j',
  (invalidFields) => {
    const result = completedResult()
    expect(() =>
      executeBulkOperationJsonOutputSchema.validate({...result, operation: {...result.operation, ...invalidFields}}),
    ).toThrow()
  },
)

test('encodes missing operations and empty lists as distinct results', () => {
  const missing = {operationId: 'gid://shopify/BulkOperation/123', operation: null}
  expect(JSON.parse(bulkOperationStatusJsonOutputSchema.encode(missing))).toEqual(missing)
  expect(JSON.parse(bulkOperationStatusJsonOutputSchema.encode({operations: []}))).toEqual({operations: []})
})

test('reuses the operation fields for lists without requiring a type', () => {
  const {type: _type, ...operation} = completedResult().operation!
  expect(JSON.parse(bulkOperationStatusJsonOutputSchema.encode({operations: [operation]}))).toEqual({
    operations: [operation],
  })
})

test('preserves upstream cancellation errors with omitted and null fields', () => {
  const result = {operation: null, userErrors: [{message: 'Not found'}, {field: null, message: 'Cannot cancel'}]}
  expect(JSON.parse(cancelBulkOperationJsonOutputSchema.encode(result))).toEqual(result)
})

test('keeps the original starting banner in text mode', () => {
  logBulkOperationStart('Starting bulk operation.', {storeFqdn: 'shop.myshopify.com', version: '2026-01'}, 'text')
  expect(renderInfo).toHaveBeenCalledWith({
    headline: 'Starting bulk operation.',
    body: [{list: {items: ['Store: shop.myshopify.com', 'API version: 2026-01']}}],
  })
})

test('outputs starting information without a terminal banner in JSON mode', () => {
  const output = mockAndCaptureOutput()

  logBulkOperationStart('Starting bulk operation.', {storeFqdn: 'shop.myshopify.com'}, 'json')

  expect(output.info()).toBe('Starting bulk operation.\nStore: shop.myshopify.com')
  expect(renderInfo).not.toHaveBeenCalled()
})

test('outputs the JSON result without terminal banners', async () => {
  const output = mockAndCaptureOutput()
  const result = completedResult()

  await renderExecuteBulkOperationResult(result, {format: 'json', watch: true})

  expect(JSON.parse(output.output())).toEqual(result)
  expect(renderInfo).not.toHaveBeenCalled()
  expect(renderSuccess).not.toHaveBeenCalled()
})

test.each(['', '{"id":"1"}\n{"id":"2"}\n'])(
  'writes exact JSONL bytes to a file and a JSON receipt: %j',
  async (results) => {
    const output = mockAndCaptureOutput()
    await inTemporaryDirectory(async (directory) => {
      const outputFile = joinPath(directory, 'results.jsonl')
      const result = {...completedResult(), results}

      await renderExecuteBulkOperationResult(result, {format: 'json', watch: true, outputFile})

      await expect(readFile(outputFile)).resolves.toBe(results)
      const {results: _results, ...receipt} = result
      expect(JSON.parse(output.info())).toEqual({...receipt, outputFile})
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  },
)

test('outputs JSONL in text mode', async () => {
  const output = mockAndCaptureOutput()
  const result = completedResult()

  await renderExecuteBulkOperationResult(result, {format: 'text', watch: true})

  expect(output.output()).toBe(result.results)
  expect(renderSuccess).toHaveBeenCalledWith(expect.objectContaining({headline: expect.stringContaining('succeeded')}))
})

test('preserves the background message when watching is aborted', async () => {
  const result = {...completedResult(), watchAborted: true, results: undefined}
  await renderExecuteBulkOperationResult(result, {format: 'text', watch: true})
  expect(renderInfo).toHaveBeenCalledWith({
    headline: 'Bulk operation gid://shopify/BulkOperation/123 is still running in the background.',
    body: ['Monitor its progress with:\n', {command: 'shopify store bulk status --id=123'}],
  })
})

test('keeps user errors as a nonfatal result', async () => {
  const output = mockAndCaptureOutput()
  const result = {operation: null, userErrors: [{message: 'Invalid query'}], watchAborted: false}
  const exitCode = process.exitCode
  await renderExecuteBulkOperationResult(result, {format: 'text', watch: false})
  expect(renderError).toHaveBeenCalledWith({
    headline: 'Error creating bulk operation.',
    body: {list: {items: ['Invalid query']}},
  })
  await renderExecuteBulkOperationResult(result, {format: 'json', watch: false})
  expect(JSON.parse(output.output())).toEqual(result)
  expect(process.exitCode).toBe(exitCode)
})

test('preserves the warning and bug failure when creation returns no operation or errors', async () => {
  await expect(
    renderExecuteBulkOperationResult(
      {operation: null, userErrors: [], watchAborted: false},
      {format: 'text', watch: false},
    ),
  ).rejects.toThrow(BugError)
  expect(renderWarning).toHaveBeenCalledWith({
    headline: 'Bulk operation not created successfully.',
    body: 'This is an unexpected error. Please try again later.',
  })
})

test('outputs cancellation JSON without terminal banners', () => {
  const output = mockAndCaptureOutput()
  const result = {operation: completedResult().operation, userErrors: []}

  renderCancelBulkOperationResult(result, 'gid://shopify/BulkOperation/123', 'json')

  expect(JSON.parse(output.output())).toEqual(result)
  expect(renderWarning).not.toHaveBeenCalled()
  expect(renderSuccess).not.toHaveBeenCalled()
  expect(renderInfo).not.toHaveBeenCalled()
})

test('outputs status JSON without a table or terminal banners', () => {
  const output = mockAndCaptureOutput()

  renderBulkOperationStatusResult({operations: []}, 'json')

  expect(JSON.parse(output.output())).toEqual({operations: []})
  expect(renderTable).not.toHaveBeenCalled()
  expect(renderInfo).not.toHaveBeenCalled()
})

test('keeps missing status and cancellation results nonfatal in text mode', () => {
  const exitCode = process.exitCode
  renderBulkOperationStatusResult({operationId: '123', operation: null}, 'text')
  renderCancelBulkOperationResult({operation: null, userErrors: []}, '123', 'text')
  expect(renderError).toHaveBeenCalledWith(expect.objectContaining({headline: 'Bulk operation not found.'}))
  expect(renderError).toHaveBeenCalledWith(
    expect.objectContaining({headline: 'Bulk operation not found or could not be canceled.'}),
  )
  expect(process.exitCode).toBe(exitCode)
})

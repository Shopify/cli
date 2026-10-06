import {testBulkOperation} from './bulk-operation.test-data.js'
import {renderExecuteBulkOperationResult} from './execute-result.js'
import {renderCancelBulkOperationResult} from './cancel-result.js'
import {renderBulkOperationStatusResult} from './status-result.js'
import {executeBulkOperationJsonOutputSchema} from './types.js'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath, cwd} from '@shopify/cli-kit/node/path'
import {renderInfo, renderSuccess, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import type {ExecuteBulkOperationResult} from './types.js'

vi.mock('@shopify/cli-kit/node/ui')

const originalExitCode = process.exitCode

beforeEach(() => {
  mockAndCaptureOutput().clear()
})

afterEach(() => {
  process.exitCode = originalExitCode
})

function completedResult(): ExecuteBulkOperationResult {
  return {
    store: 'shop.myshopify.com',
    apiVersion: '2026-01',
    operation: testBulkOperation({
      status: 'COMPLETED',
      completedAt: '2026-09-01T00:01:00Z',
      url: 'https://example.com/results.jsonl',
    }),
    userErrors: [],
    watchAborted: false,
    results: '{"id":"1"}\n{"id":"2"}\n',
  }
}

function expectedOperation() {
  return {
    gid: 'gid://shopify/BulkOperation/123',
    type: 'QUERY',
    status: 'COMPLETED',
    objectCount: '2',
    createdAt: '2026-09-01T00:00:00Z',
    completedAt: '2026-09-01T00:01:00Z',
    errorCode: null,
    url: 'https://example.com/results.jsonl',
    partialDataUrl: null,
  }
}

test('projects one JSON result with named fields and native inline JSONL', async () => {
  const output = mockAndCaptureOutput()
  await renderExecuteBulkOperationResult(completedResult(), {format: 'json', watch: true})
  expect(JSON.parse(output.output())).toEqual({
    storeDomain: 'shop.myshopify.com',
    apiVersion: '2026-01',
    status: 'success',
    operation: expectedOperation(),
    resultsJsonl: '{"id":"1"}\n{"id":"2"}\n',
  })
  expect(renderSuccess).not.toHaveBeenCalled()
  expect(renderInfo).not.toHaveBeenCalled()
})

test.each([2, '900719925474099312345'])('serializes the count exactly as a decimal string: %s', async (objectCount) => {
  const result = completedResult()
  const output = mockAndCaptureOutput()
  await renderExecuteBulkOperationResult(
    {...result, operation: {...result.operation!, objectCount}},
    {format: 'json', watch: true},
  )
  expect(JSON.parse(output.output()).operation.objectCount).toBe(String(objectCount))
})

test('rejects unsafe numeric counts rather than silently losing precision', async () => {
  const result = completedResult()
  await expect(
    renderExecuteBulkOperationResult(
      {
        ...result,
        operation: {...result.operation!, objectCount: Number.MAX_SAFE_INTEGER + 1},
      },
      {format: 'json', watch: true},
    ),
  ).rejects.toThrow(BugError)
  expect(mockAndCaptureOutput().output()).toBe('')
})

test('normalizes offset timestamps to whole seconds and missing projected values', async () => {
  const result = completedResult()
  const output = mockAndCaptureOutput()
  await renderExecuteBulkOperationResult(
    {
      ...result,
      store: 'custom.example.com',
      operation: {
        ...result.operation!,
        createdAt: '2026-09-01T02:00:00.789+02:00',
        completedAt: undefined,
        errorCode: undefined,
      },
    },
    {format: 'json', watch: true},
  )
  expect(JSON.parse(output.output())).toMatchObject({
    storeDomain: null,
    operation: {createdAt: '2026-09-01T00:00:00Z', completedAt: null, errorCode: null},
  })
})

test('removes fractional seconds from completion timestamps without rounding', async () => {
  const result = completedResult()
  const output = mockAndCaptureOutput()
  await renderExecuteBulkOperationResult(
    {...result, operation: {...result.operation!, completedAt: '2026-09-01T02:01:00.999+02:00'}},
    {format: 'json', watch: true},
  )
  expect(JSON.parse(output.output()).operation.completedAt).toBe('2026-09-01T00:01:00Z')
})

test('keeps upstream enum values extensible and CLI-owned structures strict', () => {
  const result = {storeDomain: null, apiVersion: null, status: 'success' as const, operation: expectedOperation()}
  expect(() =>
    executeBulkOperationJsonOutputSchema.validate({
      ...result,
      operation: {
        ...result.operation,
        status: 'NEW_SERVER_STATUS',
        errorCode: 'NEW_SERVER_ERROR',
        type: 'NEW_SERVER_TYPE',
      },
    }),
  ).not.toThrow()
  expect(() => executeBulkOperationJsonOutputSchema.validate({...result, accidentalField: true})).toThrow()
  expect(() => executeBulkOperationJsonOutputSchema.validate({...result, status: 'NEW_CLI_STATUS'})).toThrow()
  expect(() =>
    executeBulkOperationJsonOutputSchema.validate({...result, operation: {...result.operation, id: '123'}}),
  ).toThrow()
})

test.each(['', '{"id":"1"}\n{"id":"2"}\n'])(
  'writes exact native JSONL and emits only an absolute file receipt: %j',
  async (results) => {
    const output = mockAndCaptureOutput()
    await inTemporaryDirectory(async (directory) => {
      const path = joinPath(directory, 'results.jsonl')
      await renderExecuteBulkOperationResult(
        {...completedResult(), results},
        {
          format: 'json',
          watch: true,
          outputFile: relativePath(cwd(), path),
        },
      )
      await expect(readFile(path)).resolves.toBe(results)
      expect(JSON.parse(output.info())).toEqual({path, format: 'jsonl'})
      expect(renderSuccess).not.toHaveBeenCalled()
    })
  },
)

test.each([
  '{"data":{"productUpdate":{"userErrors":[{"message":"Rejected"}]}}}\n',
  '{"errors":[{"message":"Variable input has an unrecognizable field"}]}\n',
])('reports downloaded mutation errors as a partial result with a nonzero exit: %s', async (results) => {
  const output = mockAndCaptureOutput()
  await renderExecuteBulkOperationResult({...completedResult(), results}, {format: 'json', watch: true})
  expect(JSON.parse(output.output())).toMatchObject({status: 'partial', resultsJsonl: results})
  expect(process.exitCode).toBe(1)
})

test.each([
  '{"data":{"productUpdate":{"userErrors":[{"message":"Rejected"}]}}}\n',
  '{"errors":[{"message":"Variable input has an unrecognizable field"}]}\n',
])('writes downloaded mutation errors to a file and exits nonzero: %s', async (results) => {
  const output = mockAndCaptureOutput()
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'results.jsonl')
    await renderExecuteBulkOperationResult(
      {...completedResult(), results},
      {format: 'json', watch: true, outputFile: path},
    )
    await expect(readFile(path)).resolves.toBe(results)
    expect(JSON.parse(output.info())).toEqual({path, format: 'jsonl'})
    expect(process.exitCode).toBe(1)
  })
})

test('does not emit a file receipt when no results were downloaded', async () => {
  await expect(
    renderExecuteBulkOperationResult(
      {...completedResult(), results: undefined},
      {
        format: 'json',
        watch: true,
        outputFile: './results.jsonl',
      },
    ),
  ).rejects.toThrow('No results are available')
  expect(mockAndCaptureOutput().output()).toBe('')
})

test('reports cancellation of watching without losing the running operation', async () => {
  const output = mockAndCaptureOutput()
  const result = completedResult()
  await renderExecuteBulkOperationResult(
    {
      ...result,
      watchAborted: true,
      results: undefined,
      operation: {...result.operation!, status: 'RUNNING'},
    },
    {format: 'json', watch: true},
  )
  expect(JSON.parse(output.output())).toMatchObject({
    status: 'cancelled',
    reason: 'watch-aborted',
    operation: {status: 'RUNNING'},
  })
  expect(process.exitCode).toBe(originalExitCode)
})

test('routes creation user errors through the global fatal-error path', async () => {
  const userErrors = [{message: 'Invalid query', field: ['query']}]
  await expect(
    renderExecuteBulkOperationResult(
      {operation: null, userErrors, watchAborted: false},
      {
        format: 'json',
        watch: false,
      },
    ),
  ).rejects.toMatchObject({details: {userErrors}})
  expect(mockAndCaptureOutput().output()).toBe('')
})

test.each(['FAILED', 'CANCELED', 'EXPIRED'] as const)(
  'fails execution when the requested operation is %s',
  async (status) => {
    const result = completedResult()
    await expect(
      renderExecuteBulkOperationResult(
        {...result, operation: {...result.operation!, status}},
        {
          format: 'json',
          watch: true,
        },
      ),
    ).rejects.toThrow(AbortError)
    expect(mockAndCaptureOutput().output()).toBe('')
  },
)

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

test('outputs native JSONL in text mode', async () => {
  const output = mockAndCaptureOutput()
  const result = completedResult()
  await renderExecuteBulkOperationResult(result, {format: 'text', watch: true})
  expect(output.output()).toBe(result.results)
  expect(renderSuccess).toHaveBeenCalledWith(expect.objectContaining({headline: expect.stringContaining('succeeded')}))
})

test('preserves text-mode creation user errors', async () => {
  await renderExecuteBulkOperationResult(
    {operation: null, userErrors: [{message: 'Invalid query'}], watchAborted: false},
    {format: 'text', watch: false},
  )
  expect(renderError).toHaveBeenCalledWith({
    headline: 'Error creating bulk operation.',
    body: {list: {items: ['Invalid query']}},
  })
  expect(process.exitCode).toBe(originalExitCode)
})

test('preserves the warning and bug failure when creation returns neither an operation nor errors', async () => {
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

test('keeps missing cancellation nonfatal in text mode', () => {
  renderCancelBulkOperationResult({operation: null, userErrors: []}, '123', 'text')
  expect(renderError).toHaveBeenCalledWith(
    expect.objectContaining({headline: 'Bulk operation not found or could not be canceled.'}),
  )
  expect(process.exitCode).toBe(originalExitCode)
})

import BulkStatus from './status.js'
import BulkCancel from './cancel.js'
import BulkExecute from './execute.js'
import {
  testBulkOperation,
  testBulkOperationContext,
} from '../../../services/bulk-operations/bulk-operation.test-data.js'
import {prepareAppStoreContext, prepareExecuteContext} from '../../../utilities/execute-command-helpers.js'
import {createAdminSessionAsApp, resolveApiVersion} from '../../../services/graphql/common.js'
import {
  bulkOperationStatusJsonOutputSchema,
  cancelBulkOperationJsonOutputSchema,
  executeBulkOperationJsonOutputSchema,
} from '../../../services/bulk-operations/types.js'
import * as ui from '@shopify/cli-kit/node/ui'
import {
  fetchBulkOperationById,
  fetchRecentBulkOperations,
  cancelBulkOperationRequest,
  runBulkOperationQuery,
  shortBulkOperationPoll,
  watchBulkOperation,
  downloadBulkOperationResults,
} from '@shopify/cli-kit/node/api/bulk-operations'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, cwd, relativePath} from '@shopify/cli-kit/node/path'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

vi.mock('../../../utilities/execute-command-helpers.js')

vi.mock('../../../services/graphql/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/graphql/common.js')>()),
  createAdminSessionAsApp: vi.fn(),
  resolveApiVersion: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  ensureAuthenticatedAdminAsApp: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/api/bulk-operations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/api/bulk-operations')>()),
  fetchBulkOperationById: vi.fn(),
  fetchRecentBulkOperations: vi.fn(),
  cancelBulkOperationRequest: vi.fn(),
  runBulkOperationQuery: vi.fn(),
  shortBulkOperationPoll: vi.fn(),
  watchBulkOperation: vi.fn(),
  downloadBulkOperationResults: vi.fn(),
}))

const originalExitCode = process.exitCode

afterEach(() => {
  vi.unstubAllEnvs()
  process.exitCode = originalExitCode
})

function bulkOperation(overrides: Partial<BulkOperation> = {}): BulkOperation {
  return testBulkOperation({
    objectCount: '900719925474099312345',
    createdAt: '2026-09-01T02:00:00.789+02:00',
    ...overrides,
  })
}

function expectedOperation() {
  return {
    gid: 'gid://shopify/BulkOperation/123',
    type: 'QUERY',
    status: 'RUNNING',
    errorCode: null,
    createdAt: '2026-09-01T00:00:00Z',
    completedAt: null,
    objectCount: '900719925474099312345',
    url: null,
    partialDataUrl: null,
  }
}

async function runCommand(Command: typeof BulkStatus | typeof BulkCancel | typeof BulkExecute, argv: string[]) {
  const {appContextResult, store} = testBulkOperationContext()
  vi.mocked(prepareAppStoreContext).mockResolvedValue({appContextResult, store})
  vi.mocked(prepareExecuteContext).mockResolvedValue({appContextResult, store, query: 'query { shop { name } }'})
  const session = {storeFqdn: store.shopDomain, token: 'token'}
  vi.mocked(createAdminSessionAsApp).mockResolvedValue(session)
  vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue(session)
  vi.mocked(resolveApiVersion).mockResolvedValue('2026-01')
  const config = await Config.load()
  return runWithCommandEventsForCommand(argv, () => new Command(argv, config).run())
}

function assertDiagnosticEvents(stderr: string, headline: string) {
  const events = stderr
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  expect(events).toContainEqual(
    expect.objectContaining({type: 'diagnostic', level: 'info', message: expect.stringContaining(headline)}),
  )
  expect(events.every((event) => event.type === 'diagnostic' || event.type === 'progress')).toBe(true)
}

test('lists operations without inventing an unavailable type or exposing app credentials', async () => {
  const {type: _type, ...operation} = bulkOperation()
  const {type: _expectedType, ...expected} = expectedOperation()
  vi.mocked(fetchRecentBulkOperations).mockResolvedValue([operation])
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(BulkStatus, ['--json'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      operations: [expected],
      pageInfo: {hasNextPage: false},
    })
    assertDiagnosticEvents(stderr(), 'Listing bulk operations.')
  })
})

test('an empty list is one object with an empty collection', async () => {
  vi.mocked(fetchRecentBulkOperations).mockResolvedValue([])
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(BulkStatus, ['--json'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      operations: [],
      pageInfo: {hasNextPage: false},
    })
    assertDiagnosticEvents(stderr(), 'Listing bulk operations.')
  })
})

test('a missing requested operation is distinct from an empty list', async () => {
  vi.mocked(fetchBulkOperationById).mockResolvedValue(null)
  await withCapturedStandardStreams(async ({stdout}) => {
    await runCommand(BulkStatus, ['--json', '--id', '123'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      operationGid: 'gid://shopify/BulkOperation/123',
      operation: null,
    })
    expect(process.exitCode).toBe(originalExitCode)
  })
})

test('cancellation emits one result through the real service, codec, presenter, and writer', async () => {
  vi.mocked(cancelBulkOperationRequest).mockResolvedValue({
    bulkOperation: {...bulkOperation(), query: 'query { shop { name } }', rootObjectCount: '2'},
    userErrors: [],
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(BulkCancel, ['--id', '123', '--json'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      status: 'success',
      operation: expectedOperation(),
    })
    assertDiagnosticEvents(stderr(), 'Canceling bulk operation.')
  })
})

test('unwatched execution reports the operation without downloading results', async () => {
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: bulkOperation(), userErrors: []})
  vi.mocked(shortBulkOperationPoll).mockResolvedValue(bulkOperation())
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(BulkExecute, ['--query', 'query { shop { name } }', '--json'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      status: 'success',
      operation: expectedOperation(),
    })
    expect(downloadBulkOperationResults).not.toHaveBeenCalled()
    assertDiagnosticEvents(stderr(), 'Starting bulk operation.')
    const events = stderr()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({type: 'progress', status: 'started'}),
        expect.objectContaining({type: 'progress', status: 'completed'}),
      ]),
    )
  })
})

test.each(['', '{"id":"1"}\n{"id":"2"}\n'])('watched execution keeps native inline JSONL %j', async (results) => {
  const operation = bulkOperation({status: 'COMPLETED', url: 'https://example.com/results.jsonl'})
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: operation, userErrors: []})
  vi.mocked(watchBulkOperation).mockResolvedValue(operation)
  vi.mocked(downloadBulkOperationResults).mockResolvedValue(results)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(BulkExecute, ['--query', 'query { shop { name } }', '--watch', '--json'])
    expect(JSON.parse(stdout())).toEqual({
      storeDomain: 'shop.myshopify.com',
      apiVersion: '2026-01',
      status: 'success',
      operation: {...expectedOperation(), status: 'COMPLETED', url: 'https://example.com/results.jsonl'},
      resultsJsonl: results,
    })
    assertDiagnosticEvents(stderr(), 'Starting bulk operation.')
  })
})

test('file output keeps the exact JSONL bytes and prints only an absolute receipt', async () => {
  const operation = bulkOperation({status: 'COMPLETED', url: 'https://example.com/results.jsonl'})
  const results = '{"id":"1"}\r\n{"id":"2"}\n'
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: operation, userErrors: []})
  vi.mocked(watchBulkOperation).mockResolvedValue(operation)
  vi.mocked(downloadBulkOperationResults).mockResolvedValue(results)
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'results.jsonl')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(BulkExecute, [
        '--query',
        'query { shop { name } }',
        '--watch',
        '--json',
        '--output-file',
        relativePath(cwd(), path),
      ])
      expect(JSON.parse(stdout())).toEqual({path, format: 'jsonl'})
      await expect(readFile(path)).resolves.toBe(results)
      assertDiagnosticEvents(stderr(), 'Starting bulk operation.')
    })
  })
})

test('a completed query with no matches writes an empty JSONL file and a success receipt', async () => {
  const operation = bulkOperation({status: 'COMPLETED', objectCount: '0', url: null})
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: operation, userErrors: []})
  vi.mocked(watchBulkOperation).mockResolvedValue(operation)
  await inTemporaryDirectory(async (directory) => {
    const path = joinPath(directory, 'results.jsonl')
    await writeFile(path, 'previous export\n')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(BulkExecute, [
        '--query',
        'query { products { edges { node { id } } } }',
        '--watch',
        '--json',
        '--output-file',
        path,
      ])
      expect(JSON.parse(stdout())).toEqual({path, format: 'jsonl'})
      await expect(readFile(path)).resolves.toBe('')
      expect(downloadBulkOperationResults).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(originalExitCode)
      assertDiagnosticEvents(stderr(), 'Starting bulk operation.')
    })
  })
})

test('without JSON mode, watched execution preserves the exact native stdout bytes', async () => {
  const authenticationProgress = vi.spyOn(ui, 'renderSingleTask').mockImplementation(async ({task}) => task(vi.fn()))
  const operation = bulkOperation({status: 'COMPLETED', url: 'https://example.com/results.jsonl'})
  const results = '{"id":"1"}\n{"id":"2"}\n'
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: operation, userErrors: []})
  vi.mocked(watchBulkOperation).mockResolvedValue(operation)
  vi.mocked(downloadBulkOperationResults).mockResolvedValue(results)
  try {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(BulkExecute, ['--query', 'query { shop { name } }', '--watch'])
      expect(stdout()).toBe(`${results}\n`)
      expect(stderr()).toContain('Starting bulk operation.')
      expect(stderr()).toContain('Bulk operation succeeded:')
      expect(process.exitCode).toBe(originalExitCode)
    })
  } finally {
    authenticationProgress.mockRestore()
  }
})

test.each([
  {name: 'cancel', Command: BulkCancel},
  {name: 'execute', Command: BulkExecute},
])('$name user errors reach the fatal envelope without a success document', async ({Command}) => {
  const userErrors = [{field: ['id'], message: 'Operation rejected'}]
  vi.mocked(cancelBulkOperationRequest).mockResolvedValue({bulkOperation: null, userErrors})
  vi.mocked(runBulkOperationQuery).mockResolvedValue({bulkOperation: null, userErrors})
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const argv = Command === BulkCancel ? ['--id', '123'] : ['--query', 'query { shop { name } }']
    try {
      await runCommand(Command, [...argv, '--json'])
      expect.fail('The command must reject the operation.')
    } catch (error) {
      if (!(error instanceof AbortError)) throw error
      expect(error).toMatchObject({details: {userErrors}})
      expect(stdout()).toBe('')
      await handler(error)
    }
    expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort', details: {userErrors}}})
    assertDiagnosticEvents(stderr(), Command === BulkCancel ? 'Canceling bulk operation.' : 'Starting bulk operation.')
  })
})

test.each([
  {name: 'status', Command: BulkStatus, schema: bulkOperationStatusJsonOutputSchema},
  {name: 'cancel', Command: BulkCancel, schema: cancelBulkOperationJsonOutputSchema},
  {name: 'execute', Command: BulkExecute, schema: executeBulkOperationJsonOutputSchema},
] as const)('exposes the schema, JSON flag, and help for $name', ({Command, schema}) => {
  expect(Command.jsonOutputSchema).toBe(schema)
  expect(Command.flags.json).toBeDefined()
  expect(Command.baseFlags).toHaveProperty('json-schema')
  expect(Command.descriptionForHelp()).toContain(schema.name)
})
test.each([
  {json: true, noInput: false},
  {json: true, noInput: true},
  {json: false, noInput: false},
  {json: false, noInput: true},
])('status keeps output mode $json independent from input policy $noInput', async ({json, noInput}) => {
  vi.mocked(fetchBulkOperationById).mockResolvedValue(bulkOperation())
  const argv = ['--id', '123', ...(json ? ['--json'] : []), ...(noInput ? ['--no-input'] : [])]
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    const result = await runCommand(BulkStatus, argv)
    expect(result.app).toBeDefined()
    if (json) {
      expect(JSON.parse(stdout())).toEqual({
        storeDomain: 'shop.myshopify.com',
        apiVersion: '2026-01',
        operationGid: 'gid://shopify/BulkOperation/123',
        operation: expectedOperation(),
      })
      assertDiagnosticEvents(stderr(), 'Checking bulk operation status.')
    } else {
      expect(stdout()).toBe('')
      expect(stderr()).toContain('Checking bulk operation status.')
    }
    const contextFlags = vi.mocked(prepareAppStoreContext).mock.calls[0]?.[0]
    expect(contextFlags).toHaveProperty('json', json)
    if (noInput) expect(contextFlags).toHaveProperty('no-input', true)
    else expect(contextFlags).not.toHaveProperty('no-input')
  })
})

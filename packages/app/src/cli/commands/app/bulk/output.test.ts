import BulkStatus from './status.js'
import {
  testBulkOperation,
  testBulkOperationContext,
} from '../../../services/bulk-operations/bulk-operation.test-data.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {resolveApiVersion} from '../../../services/graphql/common.js'
import {bulkOperationStatusJsonOutputSchema} from '../../../services/bulk-operations/types.js'
import {fetchBulkOperationById, fetchRecentBulkOperations} from '@shopify/cli-kit/node/api/bulk-operations'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import type {BulkOperation} from '@shopify/cli-kit/node/api/bulk-operations'

vi.mock('../../../utilities/execute-command-helpers.js')

vi.mock('../../../services/graphql/common.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/graphql/common.js')>()),
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
}))

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

async function runCommand(Command: typeof BulkStatus, argv: string[]) {
  const {appContextResult, store} = testBulkOperationContext()
  const remoteApp = appContextResult.remoteApp
  vi.mocked(prepareAppStoreContext).mockResolvedValue({appContextResult, store})

  const session = {storeFqdn: store.shopDomain, token: 'token'}

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
  })
})

test('exposes the status schema, JSON flag, and help', () => {
  expect(BulkStatus.jsonOutputSchema).toBe(bulkOperationStatusJsonOutputSchema)
  expect(BulkStatus.flags.json).toBeDefined()
  expect(BulkStatus.baseFlags).toHaveProperty('json-schema')
  expect(BulkStatus.descriptionForHelp()).toContain(bulkOperationStatusJsonOutputSchema.name)
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

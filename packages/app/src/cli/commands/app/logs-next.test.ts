import Logs from './logs-next.js'
import {retrieveLogs} from '../../services/historical-logs/service.js'
import {logsOutput, type LogsResult} from '../../services/historical-logs/types.js'
import {Config} from '@oclif/core'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/historical-logs/service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/historical-logs/service.js')>()),
  retrieveLogs: vi.fn(),
}))

const originalColumns = Object.getOwnPropertyDescriptor(process.stdout, 'columns')

beforeEach(() => Object.defineProperty(process.stdout, 'columns', {value: 240, configurable: true}))

afterEach(() => {
  vi.unstubAllEnvs()
  mockAndCaptureOutput().clear()
  if (originalColumns) Object.defineProperty(process.stdout, 'columns', originalColumns)
  else Reflect.deleteProperty(process.stdout, 'columns')
})

function result(): LogsResult {
  return {
    logs: [
      {
        id: 'gid://shopify/AppLogRecord/example',
        timestamp: '2026-10-06T13:30:00.123456789Z',
        type: 'WEBHOOK_DELIVERY',
        resultStatus: 'FAILURE',
        shopMyshopifyDomain: 'example.myshopify.com',
        topic: 'orders/create',
        extra: {nested: true},
      },
    ],
    ordering: 'subset-timestamp-asc' as const,
    limitations: [
      'Used fast retrieval: returned records sorted oldest first in the CLI, not necessarily the oldest or newest matches. Additional records may match your search.',
    ],
  }
}

test('parses space/equals forms and forwards effective defaults', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new Logs(
    ['--client-id=explicit-app', '--type', 'webhook', '--topic=orders/create', '-s', 'example'],
    await Config.load(),
  ).run()
  expect(retrieveLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      'client-id': 'explicit-app',
      type: ['webhook'],
      topic: 'orders/create',
      store: 'example',
      since: '1h',
      limit: 20,
    }),
  )
  expect(mockAndCaptureOutput().output()).toContain('Used fast retrieval: returned records shown oldest first')
  expect(vi.mocked(retrieveLogs).mock.calls[0]![0].sort).toBeUndefined()
  expect(vi.mocked(retrieveLogs).mock.calls[0]![0].order).toBeUndefined()
})

test('omitted type and repeated type flags are passed to the service without inventing filter OR', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new Logs(['--client-id', 'explicit-app'], await Config.load()).run()
  expect(vi.mocked(retrieveLogs).mock.calls[0]?.[0].type).toBeUndefined()
  await new Logs(['--type', 'webhook', '--type', 'graphql', '--request-id', 'request-123'], await Config.load()).run()
  expect(retrieveLogs).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: ['webhook', 'graphql'],
      'request-id': 'request-123',
    }),
  )
})

test.each([
  {argv: ['--sort', 'timestamp'], order: undefined},
  {argv: ['--sort=timestamp', '--order=asc'], order: 'asc'},
  {argv: ['--sort', 'timestamp', '--order', 'desc'], order: 'desc'},
])('parses explicit sorting flags $argv', async ({argv, order}) => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(argv, await Config.load()).run()

  const flags = vi.mocked(retrieveLogs).mock.calls[0]![0]
  expect(flags.sort).toBe('timestamp')
  expect(flags.order).toBe(order)
})

test('accepts sorting from environment variables and requires the sort key', async () => {
  vi.stubEnv('SHOPIFY_FLAG_SORT', 'timestamp')
  vi.stubEnv('SHOPIFY_FLAG_ORDER', 'desc')
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs([], await Config.load()).run()

  expect(retrieveLogs).toHaveBeenCalledWith(expect.objectContaining({sort: 'timestamp', order: 'desc'}))
  vi.stubEnv('SHOPIFY_FLAG_SORT', undefined)
  vi.mocked(retrieveLogs).mockClear()
  await expect(new Logs([], await Config.load()).run()).rejects.toThrow()
  expect(retrieveLogs).not.toHaveBeenCalled()
})

test.each([
  ['--client-id', 'one', '--client-id=two'],
  ['--status', 'success', '--status=failure'],
  ['--store', 'one', '--store=two'],
  ['--topic', 'orders/create', '--topic=orders/delete'],
  ['--operation-name', 'one', '--operation-name=two'],
  ['--since', '1h', '--since=2h'],
  ['--limit', '10', '--limit=20'],
  ['--until', '2026-10-06T13:00:00Z', '--until=2026-10-06T14:00:00Z'],
  ['--sort', 'timestamp', '--sort=timestamp'],
  ['--sort', 'timestamp', '--order', 'asc', '--order=desc'],
])('rejects repeated singular flags %j before authentication', async (...argv) => {
  await expect(new Logs(['--type', 'webhook', ...argv], await Config.load()).run()).rejects.toThrow(
    'can only be specified once',
  )
  expect(retrieveLogs).not.toHaveBeenCalled()
})

test.each([
  ['--type', 'function'],
  ['--sort', 'id'],
  ['--sort', 'timestamp', '--order', 'ascending'],
  ['--order', 'asc'],
  ['--order', 'desc'],
  ['--type', 'webhook', '--offset', '10'],
  ['--type', 'graphql', '--client-ip', '123'],
  ['--type', 'graphql', '--user-agent', 'test'],
  ['--type', 'webhook', '--query', '{ app }'],
])('rejects missing or unsupported flags %j', async (...argv) => {
  await expect(new Logs(argv, await Config.load()).run()).rejects.toThrow()
  expect(retrieveLogs).not.toHaveBeenCalled()
})

test.each([
  {argv: ['--json'], json: true, noInput: false},
  {argv: ['--no-input'], json: false, noInput: true},
  {argv: ['--json', '--no-input'], json: true, noInput: true},
])('keeps JSON and no-input independent ($argv)', async ({argv, json, noInput}) => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new Logs(['--type', 'webhook', ...argv], await Config.load()).run()
  expect(vi.mocked(retrieveLogs).mock.calls[0]![0]['no-input'] ?? false).toBe(noInput)
  expect(mockAndCaptureOutput().output().startsWith('{')).toBe(json)
  if (json) expect(JSON.parse(mockAndCaptureOutput().output())).toEqual(result())
})

test('JSON writes one complete object without query or pagination metadata or terminal text', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'webhook', '--json', '--no-input'], await Config.load()).run()
    expect(JSON.parse(stdout())).toEqual(result())
    expect(JSON.parse(stdout())).not.toHaveProperty('query')
    expect(JSON.parse(stdout())).not.toHaveProperty('pageInfo')
    expect(stderr()).toBe('')
  })
})

test('webhook-only human output omits the inapplicable API column', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Topic / operation'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      '2026-10-06T13:30:00.123456789Z',
      'WEBHOOK_DELIVERY',
      'FAILURE',
      'example.myshopify.com',
      'orders/create',
    ])
  })
})

test.each([
  ['timestamp-asc', 'Oldest first'],
  ['timestamp-desc', 'Newest first'],
] as const)('renders %s without result disclaimers in table and JSON output', async (ordering, label) => {
  const data = {
    ...result(),
    ordering,
    limitations: [],
  }
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs([], await Config.load()).run()
    expect(stdout()).toBe('')
    expect(stderr().split('\n')[0]).toBe(`${label} by timestamp.`)
    expect(stderr()).not.toContain('Additional records may match your search.')
    expect(stderr()).not.toContain('Used fast retrieval')
    expect(stderr()).toContain('orders/create')
  })
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--json'], await Config.load()).run()
    expect(JSON.parse(stdout())).toEqual(data)
    expect(stderr()).toBe('')
  })
})

test.each(['ADMIN', undefined])('GraphQL-only human output keeps the API column for %s', async (api) => {
  const data = result()
  data.logs = [{...data.logs[0]!, type: 'GRAPHQL_REQUEST', topic: undefined, operationName: 'MyQuery', api}]
  vi.mocked(retrieveLogs).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stderr}) => {
    await new Logs(['--type', 'graphql'], await Config.load()).run()
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/).at(-1)).toBe('API')
    expect(lines[3]!.trim().split(/ {2,}/).slice(-2)).toEqual(['MyQuery', api ?? 'unknown'])
  })
})

test('human output aligns headers with mixed log rows between the warning and JSON hint', async () => {
  const data = result()
  data.logs.push({
    id: 'gid://shopify/AppLogRecord/another',
    timestamp: '2026-10-06T13:31:00Z',
    type: 'GRAPHQL_REQUEST',
    resultStatus: 'SUCCESS',
    shopMyshopifyDomain: 'longer-example.myshopify.com',
    operationName: 'QueryWithALongerOperationName',
    api: 'STOREFRONT',
  })
  vi.mocked(retrieveLogs).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs([], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[0]).toBe(
      'Used fast retrieval: returned records shown oldest first, not necessarily the oldest matching records.',
    )
    expect(lines.at(-1)).toBe('Use --json for full records.')
    expect(lines).toHaveLength(6)
    const headers = ['Timestamp', 'Type', 'Result', 'Store', 'Topic / operation', 'API']
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(headers)
    for (const [index, record] of data.logs.entries()) {
      const values = [
        record.timestamp,
        record.type,
        record.resultStatus,
        record.shopMyshopifyDomain,
        record.topic ?? record.operationName,
        record.api ?? '—',
      ]
      const row = lines[index + 3]!
      expect(row.trim().split(/ {2,}/)).toEqual(values)
      for (const [column, header] of headers.entries()) {
        expect(row.indexOf(String(values[column]))).toBe(lines[1]!.indexOf(header))
      }
    }
  })
})

test('empty human output keeps the warning and empty-result message without a table or footer', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue({...result(), logs: []})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()
    expect(stdout()).toBe('')
    expect(stderr().trim().split('\n')).toEqual([
      'Used fast retrieval: returned records shown oldest first, not necessarily the oldest matching records.',
      'No matching records returned.',
    ])
  })
})

test('human output marks abbreviated cells and does not print body data', async () => {
  const data = result()
  data.logs[0]!.topic = `orders/${'a'.repeat(150)}`
  data.logs[0]!.requestBody = 'not-in-human-summary'
  vi.mocked(retrieveLogs).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()
    expect(stdout()).toBe('')
    expect(stderr()).toContain(`orders/${'a'.repeat(92)}…`)
    expect(stderr()).toContain('Use --json for full records.')
    expect(stderr()).not.toContain('not-in-human-summary')
  })
  expect(JSON.parse(logsOutput.encode(data)).logs).toEqual(data.logs)
})

test('escapes terminal control characters in human output without changing JSON', async () => {
  const data = result()
  data.logs[0]!.topic = 'orders/\u001b[31mred\u001b[0m\nnext\u202eline'
  vi.mocked(retrieveLogs).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()
    expect(stderr()).toContain('orders/red\\u000anext\\u202eline')
    expect(stderr()).not.toContain('\u001b[31m')
  })
  expect(JSON.parse(logsOutput.encode(data)).logs).toEqual(data.logs)
})

test('publishes a strict envelope and an extensible native record schema', () => {
  expect(Logs.jsonOutputSchema).toBe(logsOutput)
  expect(Logs.descriptionForHelp()).toContain('HistoricalAppLogs')
  expect(() => logsOutput.validate({...result(), accidental: true})).toThrow()
  expect(() => logsOutput.validate({...result(), query: {clientId: 'test-app'}})).toThrow()
  expect(JSON.parse(logsOutput.encode(result())).logs[0].extra).toEqual({nested: true})
  expect(logsOutput.jsonSchema).toHaveProperty('properties.logs')
  expect(logsOutput.jsonSchema).toHaveProperty('properties.ordering.enum', [
    'subset-timestamp-asc',
    'timestamp-asc',
    'timestamp-desc',
  ])
  expect(logsOutput.jsonSchema).not.toHaveProperty('properties.query')
  expect(logsOutput.jsonSchema).not.toHaveProperty('properties.pageInfo')
  expect(() => logsOutput.validate({...result(), pageInfo: {limit: 20}})).toThrow()
})

import Logs from './logs-next.js'
import {retrieveLogs} from '../../services/historical-logs/service.js'
import {prepareLogInput} from '../../services/historical-logs/input.js'
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
        type: 'WEBHOOK',
        resultStatus: 'FAILURE',
        shopMyshopifyDomain: 'example.myshopify.com',
        topic: 'orders/create',
        extra: {nested: true},
      },
    ],
    ordering: 'subset-timestamp-asc' as const,
    limitations: [],
  }
}

test('remains hidden while historical logs are experimental', () => {
  expect(Logs.hidden).toBe(true)
})

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

test('connects existing webhook and GraphQL filter flags to their exact API filters together', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(
    [
      '--store',
      'example',
      '--status',
      'failure',
      '--topic',
      'orders/create',
      '--status-code',
      '500',
      '--operation-type',
      'QUERY',
      '--operation-name',
      'MyQuery',
      '--request-id',
      'request-123',
    ],
    await Config.load(),
  ).run()

  const flags = vi.mocked(retrieveLogs).mock.calls[0]![0]
  expect(prepareLogInput(flags).filters).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    {field: 'STATUS_CODE', operator: 'EQUALS', value: '500'},
    {field: 'OPERATION_TYPE', operator: 'EQUALS', value: 'QUERY'},
    {field: 'OPERATION_NAME', operator: 'EQUALS', value: 'MyQuery'},
    {field: 'REQUEST_ID', operator: 'EQUALS', value: 'request-123'},
  ])
})

test.each([
  {argv: []},
  {argv: ['--type=function', '--function-handle=discount', '--target', 'cart.lines.discounts.generate.run']},
])('parses Function filters from environment variables with flag precedence for $argv', async ({argv}) => {
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'function')
  vi.stubEnv('SHOPIFY_FLAG_FUNCTION_HANDLE', 'environment-handle')
  vi.stubEnv('SHOPIFY_FLAG_TARGET', 'environment-target')
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(argv, await Config.load()).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'function', backend: 'FUNCTION_RUN'}])
  expect(input.filters).toEqual([
    {field: 'FUNCTION_HANDLE', operator: 'EQUALS', value: argv.length ? 'discount' : 'environment-handle'},
    {
      field: 'TARGET',
      operator: 'EQUALS',
      value: argv.length ? 'cart.lines.discounts.generate.run' : 'environment-target',
    },
  ])
})

test.each([
  {argv: []},
  {argv: ['--type=app-event', '--event-handle=onboarding_completed']},
  {argv: ['--type', 'app-event', '--event-handle', 'onboarding_completed']},
])('parses app event filters from environment variables with flag precedence for $argv', async ({argv}) => {
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'app-event')
  vi.stubEnv('SHOPIFY_FLAG_EVENT_HANDLE', 'environment-handle')
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(argv, await Config.load()).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'app-event', backend: 'APP_EVENT'}])
  expect(input.filters).toEqual([
    {field: 'EVENT_HANDLE', operator: 'EQUALS', value: argv.length ? 'onboarding_completed' : 'environment-handle'},
  ])
})

test('parses app billing events with shared event handle, store, and status filters', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(
    ['--type', 'app-billing-event', '--event-handle=sms_sent', '--store', 'example', '--status=failure'],
    await Config.load(),
  ).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'app-billing-event', backend: 'APP_BILLING_EVENT'}])
  expect(input.filters).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'EVENT_HANDLE', operator: 'EQUALS', value: 'sms_sent'},
  ])
})

test.each([
  {argv: []},
  {argv: ['--type=rest', '--method=GET', '--request-path=/admin/api/products.json']},
  {argv: ['--type', 'rest', '--method', 'GET', '--request-path', '/admin/api/products.json']},
])('parses REST filters from environment variables with flag precedence for $argv', async ({argv}) => {
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'rest')
  vi.stubEnv('SHOPIFY_FLAG_METHOD', 'POST')
  vi.stubEnv('SHOPIFY_FLAG_REQUEST_PATH', '/environment-path')
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(argv, await Config.load()).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'rest', backend: 'REST_REQUEST'}])
  expect(input.filters).toEqual([
    {field: 'METHOD', operator: 'EQUALS', value: argv.length ? 'GET' : 'POST'},
    {field: 'REQUEST_PATH', operator: 'EQUALS', value: argv.length ? '/admin/api/products.json' : '/environment-path'},
  ])
})

test('parses Sidekick events with shared target, store, and status filters', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(
    ['--type', 'sidekick', '--target=extensions/security_scan', '--store', 'example', '--status=failure'],
    await Config.load(),
  ).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'sidekick', backend: 'SIDEKICK_EVENT'}])
  expect(input.filters).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'TARGET', operator: 'EQUALS', value: 'extensions/security_scan'},
  ])
})

test('parses UI extension errors with shared target, store, and status filters', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(
    ['--type', 'ui-extension', '--target=purchase.checkout.block.render', '--store', 'example', '--status=failure'],
    await Config.load(),
  ).run()

  const input = prepareLogInput(vi.mocked(retrieveLogs).mock.calls[0]![0])
  expect(input.types).toEqual([{name: 'ui-extension', backend: 'UI_EXTENSION'}])
  expect(input.filters).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'TARGET', operator: 'EQUALS', value: 'purchase.checkout.block.render'},
  ])
})

test('accepts the maximum limit through parsing and input validation', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(['--limit', '1000'], await Config.load()).run()

  const flags = vi.mocked(retrieveLogs).mock.calls[0]![0]
  expect(prepareLogInput(flags).limit).toBe(1000)
})

test('omitted type and repeated type flags are passed to the service without inventing filter OR', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue(result())
  await new Logs(['--client-id', 'explicit-app'], await Config.load()).run()
  expect(vi.mocked(retrieveLogs).mock.calls[0]?.[0].type).toBeUndefined()
  await new Logs(
    [
      '--type',
      'webhook',
      '--type',
      'graphql',
      '--type',
      'function',
      '--type',
      'app-event',
      '--type',
      'app-billing-event',
      '--type',
      'rest',
      '--type',
      'sidekick',
      '--type',
      'ui-extension',
      '--request-id',
      'request-123',
    ],
    await Config.load(),
  ).run()
  expect(retrieveLogs).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: ['webhook', 'graphql', 'function', 'app-event', 'app-billing-event', 'rest', 'sidekick', 'ui-extension'],
      'request-id': 'request-123',
    }),
  )
})

test.each([
  {argv: [], backend: 'WEBHOOK'},
  {argv: ['--type', 'graphql'], backend: 'GRAPHQL_REQUEST'},
])('resolves the environment log type with command-line precedence for $argv', async ({argv, backend}) => {
  vi.stubEnv('SHOPIFY_FLAG_TYPE', 'webhook')
  vi.mocked(retrieveLogs).mockResolvedValue(result())

  await new Logs(argv, await Config.load()).run()

  const flags = vi.mocked(retrieveLogs).mock.calls[0]![0]
  expect(prepareLogInput(flags).types).toEqual([expect.objectContaining({backend})])
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
  ['--function-handle', 'one', '--function-handle=two'],
  ['--target', 'one', '--target=two'],
  ['--event-handle', 'one', '--event-handle=two'],
  ['--method', 'GET', '--method=POST'],
  ['--request-path', '/one', '--request-path=/two'],
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
  ['--type', 'unsupported'],
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
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      '2026-10-06T13:30:00.123456789Z',
      'WEBHOOK',
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

test.each([
  {functionHandle: 'discount', target: 'cart.lines.discounts.generate.run', details: 'discount', status: 'FAILURE'},
  {functionHandle: null, target: 'cart.lines.discounts.generate.run', details: 'cart.lines.discounts.generate.run'},
  {target: 'cart.lines.discounts.generate.run', details: 'cart.lines.discounts.generate.run', status: null},
  {functionHandle: null, target: null, details: 'unknown'},
  {
    functionHandle: `discount\n${'a'.repeat(100)}`,
    details: `discount\\u000a${'a'.repeat(85)}…`,
    status: 'SUCCESS',
  },
])(
  'Function human output shows $details with the recorded result',
  async ({functionHandle, target, details, status}) => {
    const data = result()
    data.logs = [{...data.logs[0]!, type: 'FUNCTION_RUN', functionHandle, target, resultStatus: status}]
    vi.mocked(retrieveLogs).mockResolvedValue(data)

    await withCapturedStandardStreams(async ({stderr}) => {
      await new Logs(['--type', 'function'], await Config.load()).run()
      const lines = stderr().trim().split('\n')
      expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
      expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
        data.logs[0]!.timestamp,
        'FUNCTION_RUN',
        status ?? 'unknown',
        'example.myshopify.com',
        details,
      ])
    })
  },
)

test.each([
  {eventHandle: 'onboarding_completed', details: 'onboarding_completed'},
  {eventHandle: null, details: 'unknown'},
  {eventHandle: undefined, details: 'unknown'},
  {eventHandle: `event\n${'a'.repeat(100)}`, details: `event\\u000a${'a'.repeat(88)}…`},
])('app event human output shows $details and no result status', async ({eventHandle, details}) => {
  const data = result()
  data.logs = [{timestamp: data.logs[0]!.timestamp, type: 'APP_EVENT', shopMyshopifyDomain: null, eventHandle}]
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'app-event'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([data.logs[0]!.timestamp, 'APP_EVENT', '—', 'unknown', details])
  })
})

test.each([
  {eventHandle: 'sms_sent', details: 'sms_sent', status: 'FAILURE'},
  {eventHandle: null, details: 'unknown', status: null},
  {eventHandle: undefined, details: 'unknown', status: undefined},
  {eventHandle: `event\n${'a'.repeat(100)}`, details: `event\\u000a${'a'.repeat(88)}…`, status: 'SUCCESS'},
])('app billing event human output shows $details with the recorded result', async ({eventHandle, details, status}) => {
  const data = result()
  data.logs = [{...data.logs[0]!, type: 'APP_BILLING_EVENT', eventHandle, resultStatus: status}]
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'app-billing-event'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      data.logs[0]!.timestamp,
      'APP_BILLING_EVENT',
      status ?? 'unknown',
      'example.myshopify.com',
      details,
    ])
  })
})

test.each([
  {method: 'GET', requestPath: '/products.json', details: 'GET /products.json', status: 'FAILURE'},
  {method: 'GET', requestPath: null, details: 'GET', status: null},
  {method: undefined, requestPath: '/products.json', details: '/products.json'},
  {method: null, requestPath: null, details: 'unknown'},
  {method: undefined, requestPath: undefined, details: 'unknown'},
  {method: '', requestPath: '', details: 'unknown'},
  {method: '', requestPath: '/products.json', details: '/products.json'},
  {method: 'GET', requestPath: '', details: 'GET'},
  {method: 42, requestPath: false, details: 'unknown'},
  {method: 'GET', requestPath: `/\n${'a'.repeat(100)}`, details: `GET /\\u000a${'a'.repeat(88)}…`, status: 'SUCCESS'},
])('REST human output shows $details with the recorded result', async ({method, requestPath, details, status}) => {
  const data = result()
  data.logs = [{...data.logs[0]!, type: 'REST_REQUEST', method, requestPath, resultStatus: status, statusCode: 200}]
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'rest'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      data.logs[0]!.timestamp,
      'REST_REQUEST',
      status ?? 'unknown',
      'example.myshopify.com',
      details,
    ])
  })
})

test.each([
  {target: 'extensions/security_scan', details: 'extensions/security_scan', status: 'FAILURE'},
  {target: null, details: 'unknown', status: null},
  {target: undefined, details: 'unknown', status: undefined},
  {target: `extensions/\n${'a'.repeat(100)}`, details: `extensions/\\u000a${'a'.repeat(82)}…`, status: 'SUCCESS'},
])('Sidekick human output shows $details with the recorded result', async ({target, details, status}) => {
  const data = result()
  data.logs = [
    {...data.logs[0]!, type: 'SIDEKICK_EVENT', target, resultStatus: status, errorMessage: 'not-in-human-summary'},
  ]
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'sidekick'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      data.logs[0]!.timestamp,
      'SIDEKICK_EVENT',
      status ?? 'unknown',
      'example.myshopify.com',
      details,
    ])
    expect(stderr()).not.toContain('not-in-human-summary')
  })
})

test.each([
  {target: 'purchase.checkout.block.render', details: 'purchase.checkout.block.render', status: 'FAILURE'},
  {target: null, details: 'unknown', status: null},
  {target: undefined, details: 'unknown', status: undefined},
  {target: `extensions/\n${'a'.repeat(100)}`, details: `extensions/\\u000a${'a'.repeat(82)}…`, status: 'SUCCESS'},
])('UI extension error human output shows $details with the recorded result', async ({target, details, status}) => {
  const data = result()
  data.logs = [
    {...data.logs[0]!, type: 'UI_EXTENSION', target, resultStatus: status, errorMessage: 'not-in-human-summary'},
  ]
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'ui-extension'], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(['Timestamp', 'Type', 'Result', 'Store', 'Details'])
    expect(lines[3]!.trim().split(/ {2,}/)).toEqual([
      data.logs[0]!.timestamp,
      'UI_EXTENSION',
      status ?? 'unknown',
      'example.myshopify.com',
      details,
    ])
    expect(stderr()).not.toContain('not-in-human-summary')
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
  data.logs.push({
    timestamp: '2026-10-06T13:32:00Z',
    type: 'FUNCTION_RUN',
    resultStatus: 'FAILURE',
    shopMyshopifyDomain: 'example.myshopify.com',
    functionHandle: 'discount',
    target: 'cart.lines.discounts.generate.run',
  })
  data.logs.push({
    timestamp: '2026-10-06T13:33:00Z',
    type: 'APP_EVENT',
    shopMyshopifyDomain: 'example.myshopify.com',
    eventHandle: 'onboarding_completed',
  })
  data.logs.push({
    timestamp: '2026-10-06T13:34:00Z',
    type: 'APP_BILLING_EVENT',
    resultStatus: 'SUCCESS',
    shopMyshopifyDomain: 'example.myshopify.com',
    eventHandle: 'sms_sent',
  })
  data.logs.push({
    timestamp: '2026-10-06T13:35:00Z',
    type: 'REST_REQUEST',
    resultStatus: 'FAILURE',
    shopMyshopifyDomain: 'example.myshopify.com',
    method: 'GET',
    requestPath: '/products.json',
  })
  data.logs.push({
    timestamp: '2026-10-06T13:36:00Z',
    type: 'SIDEKICK_EVENT',
    resultStatus: 'SUCCESS',
    shopMyshopifyDomain: 'example.myshopify.com',
    target: 'extensions/security_scan',
  })
  data.logs.push({
    timestamp: '2026-10-06T13:37:00Z',
    type: 'UI_EXTENSION',
    resultStatus: 'SUCCESS',
    shopMyshopifyDomain: 'example.myshopify.com',
    target: 'purchase.checkout.block.render',
  })
  vi.mocked(retrieveLogs).mockResolvedValue(data)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs([], await Config.load()).run()
    expect(stdout()).toBe('')
    const lines = stderr().trim().split('\n')
    expect(lines[0]).toBe('Used fast retrieval: returned records shown oldest first.')
    expect(lines.at(-1)).toBe('Use --json for full records.')
    expect(lines).toHaveLength(13)
    expect(lines.at(-2)).toBe('Returned all 8 matching records available at query time.')
    const headers = ['Timestamp', 'Type', 'Result', 'Store', 'Details', 'API']
    expect(lines[1]!.trim().split(/ {2,}/)).toEqual(headers)
    for (const [index, record] of data.logs.entries()) {
      const values = [
        record.timestamp,
        record.type,
        record.resultStatus ?? '—',
        record.shopMyshopifyDomain,
        record.topic ??
          record.operationName ??
          record.functionHandle ??
          record.eventHandle ??
          record.target ??
          `${record.method} ${record.requestPath}`,
        record.api ?? '—',
      ]
      const row = lines[index + 3]!
      expect(row.trim().split(/ {2,}/)).toEqual(values)
      for (const [column, header] of headers.entries()) {
        const start = lines[1]!.indexOf(header)
        expect(row.slice(start, start + String(values[column]).length)).toBe(String(values[column]))
      }
    }
  })
})

test('empty human output confirms no matches without a table or footer', async () => {
  vi.mocked(retrieveLogs).mockResolvedValue({...result(), logs: []})
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()
    expect(stdout()).toBe('')
    expect(stderr().trim().split('\n')).toEqual(['No matching records available at query time.'])
  })
})

test.each(['subset-timestamp-asc', 'timestamp-asc', 'timestamp-desc'] as const)(
  'human output confirms a below-limit result for %s',
  async (ordering) => {
    vi.mocked(retrieveLogs).mockResolvedValue({...result(), ordering})

    await withCapturedStandardStreams(async ({stderr}) => {
      await new Logs(['--limit', '2'], await Config.load()).run()

      expect(stderr()).toContain('Returned all 1 matching record available at query time.')
      expect(stderr()).not.toContain('additional records may match')
      expect(stderr()).not.toContain('not necessarily')
    })
  },
)

test.each(['subset-timestamp-asc', 'timestamp-asc', 'timestamp-desc'] as const)(
  'human output warns at the requested limit for %s without asserting completeness',
  async (ordering) => {
    const data = {...result(), ordering, limitations: ['Reached the limit of 1 record; additional records may match.']}
    vi.mocked(retrieveLogs).mockResolvedValue(data)

    await withCapturedStandardStreams(async ({stderr}) => {
      await new Logs(['--limit', '1'], await Config.load()).run()

      expect(stderr()).toContain('Reached the limit of 1 record; additional records may match.')
      expect(stderr()).not.toContain('Returned all')
    })
  },
)

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

test.each([
  {topic: `${'a'.repeat(98)}😀z`, displayed: `${'a'.repeat(98)}…`},
  {topic: `${'a'.repeat(98)}\nz`, displayed: `${'a'.repeat(98)}…`},
  {topic: `${'a'.repeat(93)}\nzz`, displayed: `${'a'.repeat(93)}\\u000a…`},
  {topic: `${'a'.repeat(98)}😀`, displayed: `${'a'.repeat(98)}😀`},
])('human output keeps Unicode and control escapes intact when abbreviating $topic', async ({topic, displayed}) => {
  const data = result()
  data.logs[0]!.topic = topic
  vi.mocked(retrieveLogs).mockResolvedValue(data)

  await withCapturedStandardStreams(async ({stderr}) => {
    await new Logs(['--type', 'webhook'], await Config.load()).run()

    expect(stderr().trim().split('\n')[3]!.trim().split(/ {2,}/).at(-1)).toBe(displayed)
  })
  expect(JSON.parse(logsOutput.encode(data)).logs[0].topic).toBe(topic)
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
  expect(Logs.description).toContain('HistoricalAppLogs')
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

import {prepareLogInput, resolveLogWindow, type LogInput} from './input.js'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'

beforeEach(() => vi.useFakeTimers({toFake: ['Date'], now: new Date('2026-10-06T14:00:00Z')}))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function window(input: Pick<LogInput, 'since' | 'until'> = {}) {
  return resolveLogWindow(prepareLogInput(input).window)
}

test('defaults to both types and a bounded shared limit', () => {
  expect(prepareLogInput({})).toMatchObject({
    types: [{backend: 'WEBHOOK_DELIVERY'}, {backend: 'GRAPHQL_REQUEST'}],
    limit: 20,
    filters: [],
  })
  expect(prepareLogInput({type: ['graphql', 'graphql']}).types).toEqual([
    expect.objectContaining({backend: 'GRAPHQL_REQUEST'}),
  ])
})

test.each([
  [{}, 'none'],
  [{sort: 'timestamp'}, 'timestamp-asc'],
  [{sort: 'timestamp', order: 'asc'}, 'timestamp-asc'],
  [{sort: 'timestamp', order: 'desc'}, 'timestamp-desc'],
] satisfies [LogInput, string][])('resolves ordering for %j without sorting by default', (input, ordering) => {
  expect(prepareLogInput(input).ordering).toBe(ordering)
})

test('normalizes the store and sends exact predicates to the server before the limit', () => {
  vi.stubEnv('SHOPIFY_SERVICE_ENV', 'local')
  expect(
    prepareLogInput({
      type: ['webhook'],
      store: 'https://EXAMPLE.myshopify.com/admin',
      topic: 'orders/create',
      status: 'failure',
      'status-code': '500',
    }).filters,
  ).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'FAILURE'},
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    {field: 'STATUS_CODE', operator: 'EQUALS', value: '500'},
  ])
  expect(prepareLogInput({store: 'EXAMPLE'}).filters).toEqual([
    {field: 'SHOP_MYSHOPIFY_DOMAIN', operator: 'EQUALS', value: 'example.myshopify.com'},
  ])
})

test('maps every GraphQL flag without assuming Admin API or parsing opaque values', () => {
  expect(
    prepareLogInput({
      type: ['graphql'],
      status: 'success',
      'operation-name': 'MyQuery',
      'operation-type': 'query',
      'request-id': 'opaque,request-id',
    }).filters,
  ).toEqual([
    {field: 'RESULT_STATUS', operator: 'EQUALS', value: 'SUCCESS'},
    {field: 'OPERATION_TYPE', operator: 'EQUALS', value: 'query'},
    {field: 'OPERATION_NAME', operator: 'EQUALS', value: 'MyQuery'},
    {field: 'REQUEST_ID', operator: 'EQUALS', value: 'opaque,request-id'},
  ])
})

test.each([
  [{type: ['graphql,webhook']}, 'Supported log types'],
  [{type: ['function']}, 'Supported log types'],
  [{type: []}, 'at least one'],
  [{'status-code': '5xx'}, 'exact code'],
  [{topic: 'orders/*'}, 'slash-form'],
  [{store: 'custom.example.com'}, 'myshopify.com'],
  [{status: 'unknown'}, 'success or failure'],
  [{topic: ' '}, 'nonempty'],
  [{limit: 0}, '--limit'],
  [{limit: 1001}, '--limit'],
  [{limit: 1.5}, '--limit'],
  [{sort: 'id'}, '--sort'],
  [{sort: 'timestamp', order: 'ascending'}, '--order'],
  [{order: 'asc'}, '--order requires --sort'],
  [{order: 'desc'}, '--order requires --sort'],
] satisfies [LogInput, string][])('rejects unsupported query %j', (input, message) => {
  expect(() => prepareLogInput(input)).toThrow(message)
})

test('preserves all AND filters even when their types do not overlap', () => {
  expect(prepareLogInput({topic: 'orders/create', 'operation-name': 'MyQuery'}).filters).toEqual([
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
    {field: 'OPERATION_NAME', operator: 'EQUALS', value: 'MyQuery'},
  ])
  expect(prepareLogInput({type: ['graphql'], topic: 'orders/create'}).filters).toEqual([
    {field: 'TOPIC', operator: 'EQUALS', value: 'orders/create'},
  ])
})

test('enforces the byte limit without truncating filter values', () => {
  expect(prepareLogInput({'operation-name': 'é'.repeat(512)}).filters[0]?.value).toBe('é'.repeat(512))
  expect(() => prepareLogInput({'operation-name': 'é'.repeat(513)})).toThrow('1024 UTF-8 bytes')
})

test('anchors the default hour to the local clock truncated to whole seconds', () => {
  vi.setSystemTime(new Date('2026-10-06T14:02:03.987Z'))
  expect(window()).toEqual({
    since: '2026-10-06T13:02:03Z',
    until: '2026-10-06T14:02:03Z',
  })
})

test('normalizes whole-second offset inputs to UTC and makes since relative to until', () => {
  expect(window({until: '2026-10-06T09:30:00-04:00', since: '1h'})).toMatchObject({
    until: '2026-10-06T13:30:00Z',
    since: '2026-10-06T12:30:00Z',
  })
})

test.each([
  [{since: '8d'}, {since: '2026-09-28T14:00:00Z', until: '2026-10-06T14:00:00Z'}],
  [
    {since: '2026-09-01T14:00:00Z', until: '2026-09-09T14:00:00Z'},
    {since: '2026-09-01T14:00:00Z', until: '2026-09-09T14:00:00Z'},
  ],
  [{until: '2026-10-06T14:02:00Z'}, {since: '2026-10-06T13:02:00Z', until: '2026-10-06T14:02:00Z'}],
])('leaves time-policy eligibility to the server for %j', (input, expected) => {
  expect(window(input)).toEqual(expected)
})

test.each([
  {since: '0h'},
  {since: '-1h'},
  {since: '1.5h'},
  {since: '999999999999999999d'},
  {since: '100000000000000s'},
  {since: '2026-10-06'},
  {since: '2026-10-06T13:00:00'},
  {since: '2026-09-31T13:00:00Z'},
  {since: '2026-10-06T24:00:00Z'},
  {since: '2026-10-06T13:00:00+25:00'},
  {until: '2026-10-06T14:00:00.000Z'},
  {until: '2026-10-06T14:00:00.123456789Z'},
  {since: '2026-10-06T13:00:00Z', until: '2026-10-06T13:00:00Z'},
  {since: '2026-10-06T14:00:00Z', until: '2026-10-06T13:00:00Z'},
  {since: '2026-10-06T14:00:00Z'},
])('rejects invalid or empty windows %j', (input) => {
  expect(() => window(input)).toThrow(expect.objectContaining({code: 'INVALID_ARGUMENT'}))
})

test('preserves explicit bounds independently of the current time', () => {
  expect(window({since: '2026-10-05T09:00:00-04:00', until: '2026-10-05T10:00:00-04:00'})).toEqual({
    since: '2026-10-05T13:00:00Z',
    until: '2026-10-05T14:00:00Z',
  })
})

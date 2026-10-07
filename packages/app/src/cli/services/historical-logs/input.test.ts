import {prepareLogInput, resolveLogWindow} from './input.js'
import {expect, test, vi} from 'vitest'

const serverTime = 'Tue, 06 Oct 2026 14:00:00 GMT'

test('uses all types and a bounded default limit', () => {
  expect(prepareLogInput({})).toEqual({
    types: ['webhook', 'function', 'graphql', 'rest'],
    backendTypes: ['WEBHOOK_DELIVERY', 'FUNCTION_RUN', 'GRAPHQL_REQUEST', 'REST_REQUEST'],
    limit: 20,
  })
})

test('deduplicates selected types', () => {
  expect(prepareLogInput({type: ['webhook', 'webhook', 'function'], limit: 1000})).toEqual({
    types: ['webhook', 'function'],
    backendTypes: ['WEBHOOK_DELIVERY', 'FUNCTION_RUN'],
    limit: 1000,
  })
})

test.each([{type: ['unknown']}, {type: ['graphql,webhook']}, {limit: 0}, {limit: 1001}, {limit: 1.5}])(
  'rejects invalid query controls %j',
  (input) => {
    expect(() => prepareLogInput(input)).toThrow()
  },
)

test('anchors the default hour to service time', () => {
  vi.useFakeTimers({now: new Date('2030-01-01T00:00:00Z')})
  try {
    expect(resolveLogWindow({}, serverTime)).toEqual({
      since: '2026-10-06T13:00:00Z',
      until: '2026-10-06T14:00:00.000Z',
      anchor: '2026-10-06T14:00:00.000Z',
    })
  } finally {
    vi.useRealTimers()
  }
})

test('preserves explicit offsets and nanoseconds and computes relative time without rounding', () => {
  const until = '2026-10-06T09:30:00.123456789-04:00'
  expect(resolveLogWindow({until, since: '1h'}, serverTime)).toMatchObject({
    until,
    since: '2026-10-06T12:30:00.123456789Z',
  })
  const since = '2026-10-06T13:30:00.123456788Z'
  expect(resolveLogWindow({since, until}, serverTime)).toMatchObject({since, until})
})

test('accepts exact retention and maximum-window boundaries', () => {
  expect(resolveLogWindow({since: '2026-09-06T14:00:00Z', until: '2026-09-13T14:00:00Z'}, serverTime).since).toBe(
    '2026-09-06T14:00:00Z',
  )
})

test.each([
  {since: '0h'},
  {since: '-1h'},
  {since: '1.5h'},
  {since: '8d'},
  {since: '2026-10-06'},
  {since: '2026-10-06T13:00:00'},
  {since: '2026-09-31T13:00:00Z'},
  {since: '2026-10-06T24:00:00Z'},
  {until: '2026-10-06T14:00:00.000000001Z'},
  {since: '2026-10-06T13:00:00.000000002Z', until: '2026-10-06T13:00:00.000000001Z'},
  {since: '2026-09-06T13:59:59.999999999Z', until: '2026-09-07T14:00:00Z'},
  {since: '2026-09-29T13:59:59.999999999Z'},
])('rejects invalid or out-of-bounds windows %j', (input) => {
  expect(() => resolveLogWindow(input, serverTime)).toThrow()
})

test('does not substitute client time when server time is missing', () => {
  expect(() => resolveLogWindow({}, '')).toThrow('server time')
})

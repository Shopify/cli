import {transformToEventsConfig, transformFromEventsConfig} from './app_config_events.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {describe, expect, test} from 'vitest'

const SUBSCRIPTION = {
  topic: 'orders/create',
  uri: 'https://example.com/webhook',
  actions: ['create'],
  triggers: ['title'],
  query: 'query { id }',
  query_filter: 'status:active',
}

function remote(subscription: unknown, apiVersion: string | undefined = '2026-07') {
  return {events: {api_version: apiVersion, subscription}}
}

function readObject(subscription: unknown, handle = 'Order_Notifier', apiVersion = '2026-07') {
  return transformToEventsConfig(remote(subscription, apiVersion), {module: {handle}})
}

describe('transformFromEventsConfig', () => {
  test('strips only object editing identity, resolves the URI, and never mutates local configuration', () => {
    const content = remote({...SUBSCRIPTION, handle: 'Order_Notifier', uri: '/webhooks/orders'})
    const before = structuredClone(content)
    expect(transformFromEventsConfig(content, {application_url: 'https://tunnel.example.com/'})).toEqual(
      remote({...SUBSCRIPTION, uri: 'https://tunnel.example.com/webhooks/orders'}),
    )
    expect(content).toEqual(before)
  })

  test.each([SUBSCRIPTION, [{...SUBSCRIPTION, handle: 'List_Entry'}], null, []])(
    'never serializes first-class fields for subscription %j',
    (subscription) => {
      const content = {...remote(subscription), handle: 'Exact_Case', uid: 'Exact_Case', type: 'events'}
      const before = structuredClone(content)
      expect(transformFromEventsConfig(content)).toEqual(remote(subscription))
      expect(content).toEqual(before)
    },
  )

  test('retains every list handle while resolving relative URIs', () => {
    const content = remote([
      {...SUBSCRIPTION, handle: 'one', uri: '/orders'},
      {...SUBSCRIPTION, handle: 'Two'},
    ])
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toEqual(
      remote([
        {...SUBSCRIPTION, handle: 'one', uri: 'https://example.com/orders'},
        {...SUBSCRIPTION, handle: 'Two'},
      ]),
    )
  })

  test.each([undefined, {}])('leaves relative URIs alone without an application URL: %j', (configuration) => {
    const content = remote([{...SUBSCRIPTION, handle: 'one', uri: '/orders'}])
    expect(transformFromEventsConfig(content, configuration)).toEqual(content)
  })

  test.each([undefined, null, [], 'invalid', 123])('leaves non-string URIs for server validation: %j', (uri) => {
    const content = remote({...SUBSCRIPTION, handle: 'one', uri})
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toEqual(
      remote({...SUBSCRIPTION, uri}),
    )
  })

  test.each([{}, {events: null}, {events: {}}, remote(null), remote([])])('handles empty config: %j', (content) => {
    expect(transformFromEventsConfig(content)).toEqual(content)
  })
})

describe('transformToEventsConfig', () => {
  test.each(['events', 'Order_Notifier', 'a'.repeat(50)])(
    'uses exact outer identity %s, not historical nested identity',
    (handle) => {
      const subscription = {...SUBSCRIPTION, identifier: 'server-owned', handle: 'historical-name'}
      const before = structuredClone(subscription)
      expect(readObject(subscription, handle)).toEqual(remote([{...SUBSCRIPTION, handle, api_version: '2026-07'}]))
      expect(subscription).toEqual(before)
    },
  )

  test('reconstructs handleless objects independently of writer flags', () => {
    expect(readObject(SUBSCRIPTION)).toEqual(
      remote([{...SUBSCRIPTION, handle: 'Order_Notifier', api_version: '2026-07'}]),
    )
  })

  test('requires outer metadata even when the historical nested handle exists', () => {
    expect(() => transformToEventsConfig(remote({...SUBSCRIPTION, handle: 'nested'}))).toThrow(/Events module handle/)
  })

  test.each(['', ' ', ' bad ', 'bad.name', 'a'.repeat(51)])(
    'rejects invalid outer handle %j without normalizing it',
    (handle) => {
      expect(() => readObject(SUBSCRIPTION, handle)).toThrow(/handle/)
    },
  )

  test('preserves independent list handles, ignores outer identity, and strips server identifiers', () => {
    const subscription = [{...SUBSCRIPTION, handle: 'Legacy_One', identifier: 'server'}]
    expect(readObject(subscription, 'Unrelated')).toEqual(
      remote([{...SUBSCRIPTION, handle: 'Legacy_One', api_version: '2026-07'}]),
    )
  })

  test.each([undefined, null, '', ' ', 3, 'a'.repeat(51)])('rejects missing or invalid list identity: %j', (handle) => {
    expect(() => readObject([{...SUBSCRIPTION, handle}])).toThrow(/handle/)
  })

  test.each([undefined, null, [], {}])('empty later subscriptions cannot erase earlier entries: %j', (subscription) => {
    const first = readObject(SUBSCRIPTION)
    const later = readObject(subscription, 'unused', '2026-10')
    if (Array.isArray(subscription)) expect(later.events.subscription).toEqual([])
    else expect(later.events).not.toHaveProperty('subscription')
    expect(deepMergeObjects(first, later)).toEqual({
      events: {...first.events, api_version: '2026-10'},
    })
  })

  test.each([{}, {events: undefined}, {events: null}, {events: {}}])(
    'absent config cannot erase accumulated values: %j',
    (content) => {
      const first = readObject(SUBSCRIPTION)
      expect(deepMergeObjects(first, transformToEventsConfig(content))).toEqual(first)
    },
  )

  test.each(['', 'not-an-object', 123, false, [null], ['invalid'], [[]]])(
    'rejects malformed subscriptions: %j',
    (subscription) => {
      expect(() => readObject(subscription)).toThrow(/subscription must be an object or an array/)
    },
  )

  test.each(['invalid', 42, [], false])('rejects malformed events envelopes: %j', (events) => {
    expect(() => transformToEventsConfig({events})).toThrow(/Events configuration must be an object/)
  })

  test('does not invent an effective API version', () => {
    expect(() => transformToEventsConfig({events: {subscription: SUBSCRIPTION}}, {module: {handle: 'one'}})).toThrow(
      /missing an effective API version/,
    )
    expect(
      transformToEventsConfig(
        {events: {subscription: {...SUBSCRIPTION, api_version: '2026-04'}}},
        {module: {handle: 'one'}},
      ),
    ).toEqual({
      events: {subscription: [{...SUBSCRIPTION, handle: 'one', api_version: '2026-04'}]},
    })
  })

  test.each([false, true])('pins versions for mixed objects and lists before merging (reversed: %s)', (reversed) => {
    const modules = [
      readObject(SUBSCRIPTION, 'Object', '2026-04'),
      readObject(
        [
          {...SUBSCRIPTION, handle: 'Default'},
          {...SUBSCRIPTION, handle: 'Override', api_version: '2026-01'},
          {...SUBSCRIPTION, handle: 'Equal', api_version: '2026-10'},
        ],
        'ignored',
        '2026-10',
      ),
    ]
    if (reversed) modules.reverse()
    const merged = modules.reduce((accumulated, module) => deepMergeObjects(accumulated, module))
    expect(merged.events.api_version).toEqual(reversed ? '2026-04' : '2026-10')
    expect(merged.events.subscription).toHaveLength(4)
    expect(merged.events.subscription).toEqual(
      expect.arrayContaining([
        {...SUBSCRIPTION, handle: 'Object', api_version: '2026-04'},
        {...SUBSCRIPTION, handle: 'Default', api_version: '2026-10'},
        {...SUBSCRIPTION, handle: 'Override', api_version: '2026-01'},
        {...SUBSCRIPTION, handle: 'Equal', api_version: '2026-10'},
      ]),
    )
  })

  test('leaves unknown subscription fields intact for server validation', () => {
    const subscription = {...SUBSCRIPTION, future_field: {key: 'value'}}
    expect(readObject(subscription)).toEqual(
      remote([{...subscription, handle: 'Order_Notifier', api_version: '2026-07'}]),
    )
  })

  test('rejects an empty list entry rather than silently dropping it', () => {
    expect(() => readObject([{}])).toThrow(/Events subscription handle/)
  })

  test.each(['Same', 'same'])('retains duplicate %s entries for validation, never value-deduplicates', (handle) => {
    const first = readObject(SUBSCRIPTION, 'Same')
    const second = readObject(SUBSCRIPTION, handle)
    const merged = deepMergeObjects(first, second)
    expect(merged.events.subscription).toHaveLength(2)
    expect(merged.events.subscription?.map((sub) => sub.handle)).toEqual(['Same', handle])
  })
})

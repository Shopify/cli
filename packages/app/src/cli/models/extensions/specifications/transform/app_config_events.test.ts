import {
  mergeEventsModuleConfiguration,
  transformToEventsConfig,
  transformFromEventsConfig,
} from './app_config_events.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {describe, expect, test} from 'vitest'

const subscription = {
  topic: 'orders',
  actions: ['create', 'update'],
  triggers: ['title'],
  uri: '/events/orders',
  query: 'query { id }',
  query_filter: 'status:active',
}

function moduleConfig(value: unknown, apiVersion = '2026-01') {
  return {events: {api_version: apiVersion, subscription: value}}
}

describe('transformFromEventsConfig', () => {
  test('resolves relative URIs and removes only object identity from a copy', () => {
    const content = moduleConfig({...subscription, handle: 'Orders_Updated'})
    const original = structuredClone(content)
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com/'})).toEqual(
      moduleConfig({...subscription, uri: 'https://example.com/events/orders'}),
    )
    expect(content).toEqual(original)
  })

  test('retains independent list identity and resolves URIs', () => {
    const list = [
      {...subscription, handle: 'Orders'},
      {...subscription, handle: 'Products', uri: 'https://other.example.com/events'},
    ]
    expect(transformFromEventsConfig(moduleConfig(list), {application_url: 'https://example.com'})).toEqual(
      moduleConfig([{...list[0], uri: 'https://example.com/events/orders'}, list[1]]),
    )
  })

  test.each([undefined, {}, {application_url: ''}])('retains relative URIs without an app URL: %j', (app) => {
    expect(transformFromEventsConfig(moduleConfig([subscription]), app)).toEqual(moduleConfig([subscription]))
  })

  test.each(['https://absolute.example.com', 'pubsub://project:topic', 'arn:aws:events:us-east-1:123:source'])(
    'retains absolute and non-HTTP URI %s',
    (uri) => {
      const content = moduleConfig([{...subscription, uri}])
      expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toEqual(content)
    },
  )

  test.each([undefined, null, 7, false])('leaves absent/non-string URI %j for server validation', (uri) => {
    const content = moduleConfig([{...subscription, uri}])
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toEqual(content)
  })

  test('does not manufacture an absent URI', () => {
    const content = moduleConfig([{topic: 'orders'}])
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toStrictEqual(content)
  })

  test.each([{}, {events: {}}, moduleConfig(undefined), moduleConfig(null), moduleConfig([])])(
    'handles empty content %j',
    (content) => expect(transformFromEventsConfig(content)).toEqual(content),
  )
})

describe('mergeEventsModuleConfiguration', () => {
  test.each(['Orders_Updated', 'events'])('uses authoritative outer handle %s and drops server identity', (handle) => {
    const config = moduleConfig({...subscription, handle: 'obsolete-nested', identifier: 'server-owned'})
    const original = structuredClone(config)
    expect(mergeEventsModuleConfiguration({}, {config, handle})).toEqual({
      events: {api_version: '2026-01', subscription: [{...subscription, handle, api_version: '2026-01'}]},
    })
    expect(config).toEqual(original)
  })

  test('reads a handleless object without a writer flag', () => {
    expect(mergeEventsModuleConfiguration({}, {config: moduleConfig(subscription), handle: 'Exact_CASE'})).toEqual({
      events: {api_version: '2026-01', subscription: [{...subscription, handle: 'Exact_CASE', api_version: '2026-01'}]},
    })
  })

  test('retains independent list handles, ignoring even invalid outer identity', () => {
    const list = [
      {...subscription, handle: 'One'},
      {...subscription, handle: 'Two'},
    ]
    expect(mergeEventsModuleConfiguration({}, {config: moduleConfig(list), handle: ''})).toEqual({
      events: {api_version: '2026-01', subscription: list.map((sub) => ({...sub, api_version: '2026-01'}))},
    })
  })

  test.each([undefined, null, '', ' ', 123, {}, 'not/a/handle', 'a'.repeat(51)])(
    'rejects missing or invalid object identity %j even with historical nested identity',
    (handle) => {
      expect(() =>
        mergeEventsModuleConfiguration(
          {},
          {
            config: moduleConfig({...subscription, handle: 'nested'}),
            handle,
          },
        ),
      ).toThrow('Events subscription identity requires a handle')
    },
  )

  test.each([undefined, null, '', ' ', 123, {}, 'not/a/handle', 'a'.repeat(51)])(
    'rejects missing or invalid list identity %j rather than borrowing the envelope',
    (handle) => {
      expect(() =>
        mergeEventsModuleConfiguration(
          {},
          {
            config: moduleConfig([{...subscription, handle}]),
            handle: 'outer',
          },
        ),
      ).toThrow('Events subscription identity requires a handle')
    },
  )

  test.each([false, true])('preserves mixed defaults/overrides in either order (reversed=%s)', (reverse) => {
    const modules = [
      {config: moduleConfig(subscription, '2026-07'), handle: 'Object'},
      {
        config: moduleConfig(
          [
            {...subscription, handle: 'ListDefault'},
            {...subscription, handle: 'ListOverride', api_version: '2026-10'},
          ],
          '2026-01',
        ),
        handle: 'legacy',
      },
      {config: moduleConfig({...subscription, api_version: '2025-10'}, '2026-04'), handle: 'ObjectOverride'},
    ]
    const result = (reverse ? modules.reverse() : modules).reduce(mergeEventsModuleConfiguration, {})
    expect(result.events?.api_version).toBe('2026-01')
    expect(result.events?.subscription).toHaveLength(4)
    expect(result.events?.subscription).toEqual(
      expect.arrayContaining([
        {...subscription, handle: 'Object', api_version: '2026-07'},
        {...subscription, handle: 'ListDefault', api_version: '2026-01'},
        {...subscription, handle: 'ListOverride', api_version: '2026-10'},
        {...subscription, handle: 'ObjectOverride', api_version: '2025-10'},
      ]),
    )
  })

  test.each([undefined, null, []])(
    'empty subscription %j cannot erase preceding entries or sibling config',
    (empty) => {
      const first = mergeEventsModuleConfiguration({name: 'app'}, {config: moduleConfig(subscription), handle: 'One'})
      const later = mergeEventsModuleConfiguration(first, {config: moduleConfig(empty)})
      expect(later).toEqual(first)
      expect(mergeEventsModuleConfiguration({}, {config: moduleConfig(empty)})).toStrictEqual({
        events: {api_version: '2026-01', ...(Array.isArray(empty) ? {subscription: []} : {})},
      })
    },
  )

  test('omits absent fields rather than erasing arrays during generic merge', () => {
    const first = transformToEventsConfig(moduleConfig([{...subscription, handle: 'One'}]))
    expect(deepMergeObjects(first, transformToEventsConfig({events: {}}))).toEqual(first)
    expect(transformToEventsConfig({})).toStrictEqual({events: {}})
  })

  test.each([false, 0, '', 'malformed', [null], [false], [['nested']], {}])(
    'rejects malformed nonempty subscription %j instead of dropping it',
    (value) => expect(() => mergeEventsModuleConfiguration({}, {config: moduleConfig(value)})).toThrow(),
  )

  test.each(['One', 'oNE'])('rejects duplicate identity %s across object/list modules', (handle) => {
    const first = mergeEventsModuleConfiguration({}, {config: moduleConfig(subscription), handle: 'One'})
    expect(() =>
      mergeEventsModuleConfiguration(first, {
        config: moduleConfig([{...subscription, handle}]),
      }),
    ).toThrow(`Duplicate Events subscription handle: ${handle}`)
  })

  test('rejects equal-by-value duplicates within a list instead of deduplicating', () => {
    const entry = {...subscription, handle: 'One'}
    expect(() => transformToEventsConfig(moduleConfig([entry, {...entry}]))).toThrow(
      'Duplicate Events subscription handle',
    )
  })

  test('retains explicit versions when the module default is absent', () => {
    expect(
      transformToEventsConfig({events: {subscription: [{...subscription, handle: 'One', api_version: '2026-01'}]}}),
    ).toStrictEqual({events: {subscription: [{...subscription, handle: 'One', api_version: '2026-01'}]}})
  })

  test('rejects missing effective versions rather than inheriting a different module default', () => {
    expect(() => transformToEventsConfig({events: {subscription: [{...subscription, handle: 'One'}]}})).toThrow(
      'missing its effective API version',
    )
  })

  test('does not reconstruct object identity through the config-only transform', () => {
    expect(() => transformToEventsConfig(moduleConfig({...subscription, handle: 'nested'}))).toThrow(
      'Events subscription identity requires a handle',
    )
  })
})

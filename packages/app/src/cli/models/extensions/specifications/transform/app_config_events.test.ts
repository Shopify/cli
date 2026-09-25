import {aggregateEventsConfigurations, transformFromEventsConfig} from './app_config_events.js'
import {ConfigurationModule} from '../../specification.js'
import {describe, expect, test} from 'vitest'

const PAYLOAD = {
  topic: 'products/update',
  actions: ['update'],
  triggers: ['title'],
  uri: 'https://example.com/events',
  query: 'query { product { id title } }',
  query_filter: 'status:active',
}

function moduleWith(
  subscription: unknown,
  apiVersion: unknown = '2026-01',
  handle = 'Exact_CASE',
): ConfigurationModule {
  return {handle, config: {events: {api_version: apiVersion, subscription}}}
}

describe('transformFromEventsConfig', () => {
  test.each([undefined, {}, {application_url: 'https://tunnel.example.com/'}])(
    'omits object identity, preserves payload, and leaves local config unchanged (%j)',
    (appConfiguration) => {
      const content = {
        events: {api_version: '2026-01', subscription: {...PAYLOAD, handle: 'Exact_CASE', uri: '/events'}},
      }
      const before = structuredClone(content)
      const result = transformFromEventsConfig(content, appConfiguration)
      expect(result).toEqual({
        events: {
          api_version: '2026-01',
          subscription: {
            ...PAYLOAD,
            uri: appConfiguration?.application_url ? 'https://tunnel.example.com/events' : '/events',
          },
        },
      })
      expect(content).toEqual(before)
    },
  )

  test('retains list handles and resolves only relative URLs', () => {
    const subscriptions = [
      {...PAYLOAD, handle: 'Relative', uri: '/events'},
      {...PAYLOAD, handle: 'Absolute'},
      {...PAYLOAD, handle: 'Pubsub', uri: 'pubsub://project:topic'},
    ]
    expect(
      transformFromEventsConfig({events: {subscription: subscriptions}}, {application_url: 'https://app.com'}),
    ).toEqual({
      events: {
        subscription: [{...subscriptions[0], uri: 'https://app.com/events'}, subscriptions[1], subscriptions[2]],
      },
    })
  })

  test.each([undefined, null, 42, false])('retains a missing/invalid URI for normal validation (%j)', (uri) => {
    const subscription = {...PAYLOAD, handle: 'A', uri}
    expect(
      transformFromEventsConfig({events: {subscription: [subscription]}}, {application_url: 'https://app.com'}),
    ).toEqual({events: {subscription: [subscription]}})
  })

  test.each([{}, {events: {}}, {events: {subscription: null}}, {events: {subscription: []}}])(
    'preserves empty content (%j)',
    (content) => expect(transformFromEventsConfig(content)).toEqual(content),
  )
})

describe('aggregateEventsConfigurations', () => {
  test.each([undefined, 'historical-nested-handle'])('outer object handle is authoritative (%j)', (handle) => {
    const module = moduleWith({...PAYLOAD, handle, identifier: 'server-owned', api_version: '2026-01'})
    const before = structuredClone(module)
    expect(aggregateEventsConfigurations([module])).toEqual({
      events: {api_version: '2026-01', subscription: [{...PAYLOAD, handle: 'Exact_CASE'}]},
    })
    expect(module).toEqual(before)
  })

  test('the literal events is a valid outer identity, not a missing-handle sentinel', () => {
    expect(aggregateEventsConfigurations([moduleWith(PAYLOAD, '2026-01', 'events')])).toEqual({
      events: {api_version: '2026-01', subscription: [{...PAYLOAD, handle: 'events'}]},
    })
  })

  test.each(['', ' ', 'contains space', '!bad', 'x'.repeat(51)])('rejects invalid outer identity %j', (handle) => {
    expect(() =>
      aggregateEventsConfigurations([moduleWith({...PAYLOAD, handle: 'not-a-fallback'}, '2026-01', handle)]),
    ).toThrow('identity must be a handle')
  })

  test('retains independent legacy identities and duplicates, including case variants, for validation', () => {
    const subscription = {...PAYLOAD, handle: 'First', identifier: 'id'}
    const modules = [
      moduleWith([subscription, subscription, {...subscription, handle: 'first'}], '2026-01', 'not-used'),
    ]
    expect(aggregateEventsConfigurations(modules)).toEqual({
      events: {
        api_version: '2026-01',
        subscription: [
          {...PAYLOAD, handle: 'First'},
          {...PAYLOAD, handle: 'First'},
          {...PAYLOAD, handle: 'first'},
        ],
      },
    })
  })

  test.each([false, true])('preserves mixed modules and effective versions in either order (reverse=%j)', (reverse) => {
    const modules = [
      moduleWith({...PAYLOAD, identifier: 'server-id'}, '2026-04', 'Object'),
      moduleWith(
        [
          {...PAYLOAD, handle: 'Legacy', api_version: '2026-01'},
          {...PAYLOAD, handle: 'Override', api_version: '2026-07'},
        ],
        '2026-01',
        'ignored',
      ),
      moduleWith({...PAYLOAD, api_version: '2026-01'}, '2026-04', 'Explicit'),
    ]
    const expected = [
      [{...PAYLOAD, handle: 'Object', api_version: '2026-04'}],
      [
        {...PAYLOAD, handle: 'Legacy'},
        {...PAYLOAD, handle: 'Override', api_version: '2026-07'},
      ],
      [{...PAYLOAD, handle: 'Explicit'}],
    ]
    expect(aggregateEventsConfigurations(reverse ? [...modules].reverse() : modules)).toEqual({
      events: {api_version: '2026-01', subscription: (reverse ? [...expected].reverse() : expected).flat()},
    })
  })

  test.each([undefined, null, []])('later empty subscriptions do not erase earlier entries (%j)', (subscription) => {
    expect(aggregateEventsConfigurations([moduleWith(PAYLOAD), moduleWith(subscription)])).toEqual({
      events: {api_version: '2026-01', subscription: [{...PAYLOAD, handle: 'Exact_CASE'}]},
    })
  })

  test('empty collections retain a deterministic default and omit absent subscription properties', () => {
    expect(aggregateEventsConfigurations([])).toEqual({events: {}})
    expect(aggregateEventsConfigurations([{handle: 'ignored', config: {}}])).toEqual({events: {}})
    const result = aggregateEventsConfigurations([moduleWith(undefined, '2026-04'), moduleWith(null, '2026-01')])
    expect(result).toEqual({events: {api_version: '2026-01'}})
    expect(result.events).not.toHaveProperty('subscription')
    expect(aggregateEventsConfigurations([moduleWith([])])).toEqual({
      events: {api_version: '2026-01', subscription: []},
    })
  })

  test.each([{}, 'bad', 0, false, [null], [42], [[]], [{}]])(
    'rejects malformed nonempty subscription %j',
    (subscription) => {
      expect(() => aggregateEventsConfigurations([moduleWith(subscription)])).toThrow('Invalid Events configuration')
      expect(() => transformFromEventsConfig(moduleWith(subscription).config)).toThrow('Invalid Events configuration')
    },
  )

  test.each(['bad', 12, []])('rejects malformed events table %j', (events) => {
    expect(() => aggregateEventsConfigurations([{handle: 'A', config: {events}}])).toThrow(
      'Invalid Events configuration',
    )
  })

  test.each([null, '', 42])('rejects invalid module version %j', (version) => {
    expect(() => aggregateEventsConfigurations([moduleWith(PAYLOAD, version)])).toThrow('Invalid Events configuration')
  })

  test('does not borrow a neighboring module default, even for an explicit subscription override', () => {
    const missingDefault = {handle: 'B', config: {events: {subscription: {...PAYLOAD, api_version: '2026-01'}}}}
    expect(() => aggregateEventsConfigurations([moduleWith(PAYLOAD), missingDefault])).toThrow(
      'without events.api_version',
    )
  })

  test.each([null, '', 42])('rejects invalid subscription version %j', (version) => {
    expect(() => aggregateEventsConfigurations([moduleWith({...PAYLOAD, api_version: version})])).toThrow(
      'api_version must be a nonempty string',
    )
  })

  test.each([undefined, null, 42, '', 'with space'])('rejects missing/invalid legacy entry handle %j', (handle) => {
    expect(() => aggregateEventsConfigurations([moduleWith([{...PAYLOAD, handle}])])).toThrow(
      'identity must be a handle',
    )
  })
})

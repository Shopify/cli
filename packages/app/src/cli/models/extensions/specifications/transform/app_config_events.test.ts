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
        handle: 'Exact_CASE',
        events: {api_version: '2026-01', subscription: {...PAYLOAD, handle: 'Exact_CASE', uri: '/events'}},
      }
      const before = structuredClone(content)
      expect(transformFromEventsConfig(content, appConfiguration)).toEqual({
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

  test('retains list handles and non-HTTP URIs', () => {
    const content = {events: {subscription: [{...PAYLOAD, handle: 'Pubsub', uri: 'pubsub://project:topic'}]}}
    expect(transformFromEventsConfig(content, {application_url: 'https://app.com'})).toEqual(content)
  })

  test.each([undefined, null, 42, false])('retains a missing/invalid URI for normal validation (%j)', (uri) => {
    const subscription = {...PAYLOAD, handle: 'A', uri}
    expect(
      transformFromEventsConfig({events: {subscription: [subscription]}}, {application_url: 'https://app.com'}),
    ).toEqual({events: {subscription: [subscription]}})
  })

  test.each([{}, {events: {}}, {events: {subscription: null}}, {events: {subscription: []}}])(
    'omits first-class identity on empty-content paths (%j)',
    (content) => expect(transformFromEventsConfig({...content, handle: 'local-only'})).toEqual(content),
  )

  test('returns content as-is when all URIs are absolute', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: 'https://example.com', actions: ['create']}],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })

  test('prepends application_url to relative URIs in subscriptions', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']},
          {topic: 'products/update', uri: 'https://absolute.example.com/webhook', actions: ['update']},
        ],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://tunnel.example.com/webhooks/orders', actions: ['create']},
          {topic: 'products/update', uri: 'https://absolute.example.com/webhook', actions: ['update']},
        ],
      },
    })
  })

  test('returns content as-is when no application_url in config', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }

    const result = transformFromEventsConfig(content, {})

    expect(result).toEqual(content)
  })

  test('returns content as-is when no appConfiguration provided', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }

    const result = transformFromEventsConfig(content)

    expect(result).toEqual(content)
  })

  test('handles application_url with trailing slash', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com/'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://tunnel.example.com/webhooks/orders', actions: ['create']},
        ],
      },
    })
  })

  test('returns content as-is when subscription array is empty', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })

  test('returns content as-is when no subscriptions', () => {
    const content = {
      events: {
        api_version: '2024-01',
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })

  test('prepends application_url to a relative URI in a single subscription object', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: {topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']},
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: {topic: 'orders/create', uri: 'https://tunnel.example.com/webhooks/orders', actions: ['create']},
      },
    })
  })

  test('returns content as-is when events is undefined', () => {
    const content = {}
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })
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
    expect(
      aggregateEventsConfigurations([
        moduleWith([subscription, subscription, {...subscription, handle: 'first'}], '2026-01', 'not-used'),
      ]),
    ).toEqual({
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

  test('strips server-managed identifier field from subscriptions while preserving all other fields', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'orders',
            identifier: 'id-1',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/webhook',
            actions: ['update'],
            handle: 'my-subscription',
            triggers: ['product_updated'],
            query: 'query { id }',
            query_filter: 'status:active',
            identifier: 'id-2',
          },
        ],
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'ignored-outer', config: remoteContent}])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'orders',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/webhook',
            actions: ['update'],
            handle: 'my-subscription',
            triggers: ['product_updated'],
            query: 'query { id }',
            query_filter: 'status:active',
          },
        ],
      },
    })
  })

  test('handles missing subscription field', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'events', config: remoteContent}])

    expect(result).toEqual({events: {api_version: '2024-01'}})
    expect(result.events).not.toHaveProperty('subscription')
  })
  test('strips the identifier from a single subscription object and returns it as a one-element array', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders/create',
          uri: 'https://example.com/webhook',
          actions: ['create'],
          handle: 'order-notifier',
          identifier: 'id-1',
        },
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'order-notifier', config: remoteContent}])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'order-notifier',
          },
        ],
      },
    })
  })

  test('merging multiple single-subscription modules accumulates one subscription array', () => {
    const moduleOne = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders/create',
          uri: 'https://example.com/a',
          actions: ['create'],
          handle: 'a',
          identifier: 'id-a',
        },
      },
    }
    const moduleTwo = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'products/update',
          uri: 'https://example.com/b',
          actions: ['update'],
          handle: 'b',
          identifier: 'id-b',
        },
      },
    }

    const merged = aggregateEventsConfigurations([
      {handle: 'a', config: moduleOne},
      {handle: 'b', config: moduleTwo},
    ])

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a'},
          {topic: 'products/update', uri: 'https://example.com/b', actions: ['update'], handle: 'b'},
        ],
      },
    })
  })

  test('strips a subscription api_version that matches the events default in the list shape', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
            identifier: 'id-a',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            handle: 'b',
            api_version: '2024-01',
            identifier: 'id-b',
          },
        ],
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'ignored-outer', config: remoteContent}])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a'},
          {topic: 'products/update', uri: 'https://example.com/b', actions: ['update'], handle: 'b'},
        ],
      },
    })
  })

  test('strips a subscription api_version that matches the events default in the single shape', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders/create',
          uri: 'https://example.com/a',
          actions: ['create'],
          api_version: '2024-01',
          identifier: 'id-a',
        },
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'a', config: remoteContent}])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a'}],
      },
    })
  })

  test('keeps a subscription api_version that overrides the events default', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders/create',
          uri: 'https://example.com/a',
          actions: ['create'],
          api_version: '2025-07',
          identifier: 'id-a',
        },
      },
    }

    const result = aggregateEventsConfigurations([{handle: 'a', config: remoteContent}])

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2025-07',
          },
        ],
      },
    })
  })

  test('rejects a missing module default even when a subscription overrides it', () => {
    const remoteContent = {
      events: {
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2024-01',
            identifier: 'id-a',
          },
        ],
      },
    }

    expect(() => aggregateEventsConfigurations([{handle: 'events', config: remoteContent}])).toThrow(
      'without events.api_version',
    )
  })

  test('merging single-subscription modules keeps only the overriding api_version', () => {
    const moduleOne = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders/create',
          uri: 'https://example.com/a',
          actions: ['create'],
          handle: 'a',
          api_version: '2024-01',
          identifier: 'id-a',
        },
      },
    }
    const moduleTwo = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'products/update',
          uri: 'https://example.com/b',
          actions: ['update'],
          handle: 'b',
          api_version: '2025-07',
          identifier: 'id-b',
        },
      },
    }

    const merged = aggregateEventsConfigurations([
      {handle: 'a', config: moduleOne},
      {handle: 'b', config: moduleTwo},
    ])

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a'},
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            handle: 'b',
            api_version: '2025-07',
          },
        ],
      },
    })
  })

  test('merging a list-shape module with a single-subscription module accumulates all subscriptions', () => {
    const listModule = {
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a', identifier: 'id-a'},
        ],
      },
    }
    const singleModule = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'products/update',
          uri: 'https://example.com/b',
          actions: ['update'],
          handle: 'b',
          identifier: 'id-b',
        },
      },
    }

    const merged = aggregateEventsConfigurations([
      {handle: 'ignored-outer', config: listModule},
      {handle: 'b', config: singleModule},
    ])

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', actions: ['create'], handle: 'a'},
          {topic: 'products/update', uri: 'https://example.com/b', actions: ['update'], handle: 'b'},
        ],
      },
    })
  })
})

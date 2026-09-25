import {
  mergeEventsModuleConfiguration,
  transformToEventsConfig,
  transformFromEventsConfig,
} from './app_config_events.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {describe, expect, test} from 'vitest'

describe('transformFromEventsConfig', () => {
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
        subscription: {topic: 'orders/create', uri: '/webhooks/orders', actions: ['create'], handle: 'Exact_CASE'},
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
    expect(content.events.subscription).toEqual({
      topic: 'orders/create',
      uri: '/webhooks/orders',
      actions: ['create'],
      handle: 'Exact_CASE',
    })
  })

  test('returns content as-is when events is undefined', () => {
    const content = {}
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })

  test.each([undefined, null, 7, false, 'pubsub://project:topic', 'arn:aws:events:us-east-1:123:source'])(
    'leaves non-string and non-HTTP URI %j unchanged',
    (uri) => {
      const content = {events: {subscription: [{uri}]}}
      expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toStrictEqual(content)
    },
  )

  test('retains relative URIs with an empty app URL and does not manufacture an absent URI', () => {
    const content = {events: {subscription: [{uri: '/events'}, {topic: 'orders'}]}}
    expect(transformFromEventsConfig(content, {application_url: ''})).toStrictEqual(content)
  })

  test.each([undefined, null, [], {uri: '/events', handle: 'Exact_CASE'}, [{uri: '/events', handle: 'Exact_CASE'}]])(
    'omits first-class identity from wire config for subscription %j',
    (subscription) => {
      const config = {events: {subscription}}
      expect(transformFromEventsConfig({handle: 'Exact_CASE', ...config})).toEqual(transformFromEventsConfig(config))
    },
  )
})

describe('transformToEventsConfig', () => {
  test('strips server-managed identifier field from subscriptions while preserving all other fields', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'order-notifier',
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

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'order-notifier',
            api_version: '2024-01',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/webhook',
            actions: ['update'],
            handle: 'my-subscription',
            triggers: ['product_updated'],
            query: 'query { id }',
            query_filter: 'status:active',
            api_version: '2024-01',
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

    const result = transformToEventsConfig(remoteContent)

    expect(result).toStrictEqual({
      events: {
        api_version: '2024-01',
      },
    })
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

    const result = mergeEventsModuleConfiguration({}, {config: remoteContent, handle: 'order-notifier'})

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'order-notifier',
            api_version: '2024-01',
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

    const merged = [
      {config: moduleOne, handle: 'a'},
      {config: moduleTwo, handle: 'b'},
    ].reduce(mergeEventsModuleConfiguration, {})

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            handle: 'b',
            api_version: '2024-01',
          },
        ],
      },
    })
  })

  test('keeps a subscription api_version that matches the events default in the list shape', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2024-01',
            handle: 'a',
            identifier: 'id-a',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            api_version: '2024-01',
            handle: 'b',
            identifier: 'id-b',
          },
        ],
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            handle: 'b',
            api_version: '2024-01',
          },
        ],
      },
    })
  })

  test('keeps a subscription api_version that matches the events default in the single shape', () => {
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

    const result = mergeEventsModuleConfiguration({}, {config: remoteContent, handle: 'a'})

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
        ],
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

    const result = mergeEventsModuleConfiguration({}, {config: remoteContent, handle: 'a'})

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

  test('keeps a subscription api_version when the events default is absent', () => {
    const remoteContent = {
      events: {
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2024-01',
            handle: 'a',
            identifier: 'id-a',
          },
        ],
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toStrictEqual({
      events: {
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
        ],
      },
    })
  })

  test('merging single-subscription modules keeps each effective api_version', () => {
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

    const merged = [
      {config: moduleOne, handle: 'a'},
      {config: moduleTwo, handle: 'b'},
    ].reduce(mergeEventsModuleConfiguration, {})

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
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

    const merged = mergeEventsModuleConfiguration(transformToEventsConfig(listModule), {
      config: singleModule,
      handle: 'b',
    })

    expect(merged).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://example.com/a',
            actions: ['create'],
            handle: 'a',
            api_version: '2024-01',
          },
          {
            topic: 'products/update',
            uri: 'https://example.com/b',
            actions: ['update'],
            handle: 'b',
            api_version: '2024-01',
          },
        ],
      },
    })
  })
})

const subscription = {topic: 'orders', actions: ['update'], uri: '/events/orders'}
function moduleConfig(value: unknown) {
  return {events: {api_version: '2026-01', subscription: value}}
}

describe('mergeEventsModuleConfiguration', () => {
  test.each(['Orders_Updated', 'events'])('uses authoritative outer handle %s without mutating config', (handle) => {
    const config = moduleConfig({...subscription, handle: 'obsolete-nested', identifier: 'server-owned'})
    const original = structuredClone(config)
    expect(mergeEventsModuleConfiguration({}, {config, handle})).toEqual({
      events: {api_version: '2026-01', subscription: [{...subscription, handle, api_version: '2026-01'}]},
    })
    expect(config).toEqual(original)
  })

  test('retains independent list handles, ignoring even invalid outer identity', () => {
    const list = ['One', 'Two'].map((handle) => ({...subscription, handle}))
    expect(mergeEventsModuleConfiguration({}, {config: moduleConfig(list), handle: ''})).toEqual({
      events: {api_version: '2026-01', subscription: list.map((sub) => ({...sub, api_version: '2026-01'}))},
    })
  })

  test.each([undefined, null, '', ' ', 123, {}, 'not/a/handle', 'a'.repeat(51)])(
    'rejects invalid object and list identity %j rather than borrowing other identity',
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

  test.each([undefined, null, []])(
    'empty subscription %j cannot erase preceding entries or sibling config',
    (empty) => {
      const first = mergeEventsModuleConfiguration({name: 'app'}, {config: moduleConfig(subscription), handle: 'One'})
      expect(mergeEventsModuleConfiguration(first, {config: moduleConfig(empty)})).toEqual(first)
      expect(mergeEventsModuleConfiguration({}, {config: moduleConfig(empty)})).toStrictEqual({
        events: {api_version: '2026-01', ...(Array.isArray(empty) ? {subscription: []} : {})},
      })
      expect(transformFromEventsConfig(moduleConfig(empty))).toStrictEqual(moduleConfig(empty))
    },
  )

  test('omits absent fields rather than erasing arrays during generic merge', () => {
    const first = transformToEventsConfig(moduleConfig([{...subscription, handle: 'One'}]))
    expect(deepMergeObjects(first, transformToEventsConfig({events: {}}))).toEqual(first)
    expect(transformToEventsConfig({})).toStrictEqual({events: {}})
    expect(transformFromEventsConfig({events: {}})).toStrictEqual({events: {}})
  })

  test.each([false, 0, '', 'malformed', [null], [false], [['nested']], {}])(
    'rejects malformed nonempty subscription %j instead of dropping it',
    (value) => expect(() => mergeEventsModuleConfiguration({}, {config: moduleConfig(value)})).toThrow(),
  )

  test.each(['One', 'oNE'])('rejects duplicate identity %s across object/list modules', (handle) => {
    const first = mergeEventsModuleConfiguration({}, {config: moduleConfig(subscription), handle: 'One'})
    expect(() => mergeEventsModuleConfiguration(first, {config: moduleConfig([{...subscription, handle}])})).toThrow(
      `Duplicate Events subscription handle: ${handle}`,
    )
  })

  test('rejects equal-by-value duplicates within a list instead of deduplicating', () => {
    const entry = {...subscription, handle: 'One'}
    expect(() => transformToEventsConfig(moduleConfig([entry, {...entry}]))).toThrow(
      'Duplicate Events subscription handle',
    )
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

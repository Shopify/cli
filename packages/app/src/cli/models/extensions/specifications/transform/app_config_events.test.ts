import {transformToEventsConfig, transformFromEventsConfig} from './app_config_events.js'
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
          {topic: 'orders/create', uri: '/webhooks/orders', actions: ['create'], handle: 'Order_Notifier'},
          {
            topic: 'products/update',
            uri: 'https://absolute.example.com/webhook',
            actions: ['update'],
            handle: 'Product',
          },
        ],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders/create',
            uri: 'https://tunnel.example.com/webhooks/orders',
            actions: ['create'],
            handle: 'Order_Notifier',
          },
          {
            topic: 'products/update',
            uri: 'https://absolute.example.com/webhook',
            actions: ['update'],
            handle: 'Product',
          },
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
        subscription: {topic: 'orders/create', uri: '/webhooks/orders', actions: ['create'], handle: 'Order_Notifier'},
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

  test.each([undefined, null, [], 'invalid', 123])('leaves non-string URIs for validation: %j', (uri) => {
    const content = {events: {subscription: {uri, handle: 'one'}}}
    expect(transformFromEventsConfig(content, {application_url: 'https://example.com'})).toEqual({
      events: {subscription: {uri}},
    })
  })

  test.each([
    {},
    {events: null},
    {events: {}},
    {events: {subscription: null}},
    {events: {subscription: []}},
    {events: {subscription: [{handle: 'List_Entry'}]}},
  ])('never serializes first-class fields or mutates configuration: %j', (content) => {
    const before = structuredClone(content)
    expect(transformFromEventsConfig({...content, handle: 'Exact_Case', uid: 'Exact_Case', type: 'events'})).toEqual(
      content,
    )
    expect(content).toEqual(before)
  })

  test('returns content as-is when events is undefined', () => {
    const content = {}
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })
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

    expect(result).toEqual({
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
          identifier: 'id-1',
        },
      },
    }

    const result = transformToEventsConfig(remoteContent, {module: {handle: 'order-notifier'}})

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

    const merged = deepMergeObjects(
      transformToEventsConfig(moduleOne, {module: {handle: 'a'}}),
      transformToEventsConfig(moduleTwo, {module: {handle: 'b'}}),
    )

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

    const result = transformToEventsConfig(remoteContent, {module: {handle: 'a'}})

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

    const result = transformToEventsConfig(remoteContent, {module: {handle: 'a'}})

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

    expect(result).toEqual({
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

  test('merging single-subscription modules keeps both effective api_versions', () => {
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

    const merged = deepMergeObjects(
      transformToEventsConfig(moduleOne, {module: {handle: 'a'}}),
      transformToEventsConfig(moduleTwo, {module: {handle: 'b'}}),
    )

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

  test.each(['events', 'Order_Notifier', 'a'.repeat(50)])('uses exact outer identity %s without mutation', (handle) => {
    const fields = {topic: 'products', uri: '/events', future_field: true}
    const content = {
      events: {api_version: '2026-07', subscription: {...fields, handle: 'historical', identifier: 'server'}},
    }
    const before = structuredClone(content)
    const result = transformToEventsConfig(content, {module: {handle}})
    expect(result).toEqual({
      events: {
        api_version: '2026-07',
        subscription: [{...fields, handle, api_version: '2026-07'}],
      },
    })
    const editing = {...content, handle, uid: handle, type: 'events'}
    const editingBefore = structuredClone(editing)
    expect(transformFromEventsConfig(editing)).toEqual({
      events: {
        api_version: '2026-07',
        subscription: {...fields, identifier: 'server'},
      },
    })
    expect(content).toEqual(before)
    expect(editing).toEqual(editingBefore)
  })

  test.each([undefined, '', ' ', ' bad ', 'bad.name', 'a'.repeat(51)])(
    'rejects invalid outer identity %j',
    (handle) => {
      const content = {events: {api_version: '2026-07', subscription: {handle: 'historical'}}}
      expect(() => transformToEventsConfig(content, handle === undefined ? undefined : {module: {handle}})).toThrow(
        /Events module handle/,
      )
    },
  )

  test.each([undefined, null, '', ' ', 3, 'a'.repeat(51)])('rejects invalid list identity %j', (handle) => {
    expect(() => transformToEventsConfig({events: {api_version: '2026-07', subscription: [{handle}]}})).toThrow(
      /Events subscription handle/,
    )
  })

  test.each([undefined, null, [], {}])('empty later subscriptions cannot erase earlier entries: %j', (subscription) => {
    const first = transformToEventsConfig({events: {api_version: '2026-04', subscription: [{handle: 'one'}]}})
    const later = transformToEventsConfig({events: {api_version: '2026-10', subscription}})
    if (Array.isArray(subscription)) expect(later.events.subscription).toEqual([])
    else expect(later.events).not.toHaveProperty('subscription')
    expect(deepMergeObjects(first, later)).toEqual({events: {...first.events, api_version: '2026-10'}})
  })

  test.each([{}, {events: undefined}, {events: null}, {events: {}}])(
    'absent config cannot erase accumulated values: %j',
    (content) => {
      const first = {events: {api_version: '2026-07', subscription: [{handle: 'one'}]}}
      expect(deepMergeObjects(first, transformToEventsConfig(content))).toEqual(first)
    },
  )

  test.each(['', 'not-an-object', 123, false, [null], ['invalid'], [[]]])(
    'rejects malformed subscriptions: %j',
    (subscription) => {
      expect(() => transformToEventsConfig({events: {subscription}})).toThrow(
        /subscription must be an object or an array/,
      )
    },
  )

  test.each(['invalid', 42, [], false])('rejects malformed events envelopes: %j', (events) => {
    expect(() => transformToEventsConfig({events})).toThrow(/Events configuration must be an object/)
  })

  test('requires an effective API version, not necessarily a module default', () => {
    expect(() => transformToEventsConfig({events: {subscription: {handle: 'one'}}}, {module: {handle: 'one'}})).toThrow(
      /missing an effective API version/,
    )
    expect(
      transformToEventsConfig({events: {subscription: {api_version: '2026-04'}}}, {module: {handle: 'one'}}),
    ).toEqual({events: {subscription: [{handle: 'one', api_version: '2026-04'}]}})
  })

  test('rejects an empty list entry rather than silently dropping it', () => {
    expect(() => transformToEventsConfig({events: {api_version: '2026-07', subscription: [{}]}})).toThrow(
      /Events subscription handle/,
    )
  })

  test.each(['Same', 'same'])('retains duplicate %s entries for validation, never value-deduplicates', (handle) => {
    const content = {events: {api_version: '2026-07', subscription: {topic: 'products'}}}
    const merged = deepMergeObjects(
      transformToEventsConfig(content, {module: {handle: 'Same'}}),
      transformToEventsConfig(content, {module: {handle}}),
    )
    expect(merged.events.subscription?.map((subscription) => subscription.handle)).toEqual(['Same', handle])
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

    const merged = deepMergeObjects(
      transformToEventsConfig(listModule, {module: {handle: 'unrelated'}}),
      transformToEventsConfig(singleModule, {module: {handle: 'b'}}),
    )

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

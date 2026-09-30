import {transformToEventsConfig, transformFromEventsConfig} from './app_config_events.js'
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
        subscription: {topic: 'orders', uri: '/webhooks/orders', actions: ['create']},
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: {topic: 'orders', uri: 'https://tunnel.example.com/webhooks/orders', actions: ['create']},
      },
    })
  })

  test('returns content as-is when events is undefined', () => {
    const content = {}
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual(content)
  })

  test('leaves subscriptions without a string uri untouched while resolving the others', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders', actions: ['create']},
          {topic: 'orders', uri: null, actions: ['paid']},
          {topic: 'products', uri: 123, actions: ['create']},
          {topic: 'products', uri: '/webhooks/products', actions: ['update']},
        ],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders', actions: ['create']},
          {topic: 'orders', uri: null, actions: ['paid']},
          {topic: 'products', uri: 123, actions: ['create']},
          {topic: 'products', uri: 'https://tunnel.example.com/webhooks/products', actions: ['update']},
        ],
      },
    })
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

  test('strips subscription api_version matching the events default while keeping overrides', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a', api_version: '2024-01', identifier: 'id-a'},
          {topic: 'products/update', uri: 'https://example.com/b', api_version: '2025-07', identifier: 'id-b'},
        ],
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {topic: 'orders/create', uri: 'https://example.com/a'},
          {topic: 'products/update', uri: 'https://example.com/b', api_version: '2025-07'},
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

  test('handles a null subscription field', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: null,
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toStrictEqual({
      events: {
        api_version: '2024-01',
      },
    })
  })
  test('normalizes a single subscription, removes derived fields, and preserves its handle', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders',
          uri: 'https://example.com/webhook',
          actions: ['create'],
          handle: 'order-notifier',
          api_version: '2024-01',
          identifier: 'id-1',
        },
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'order-notifier',
          },
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
            topic: 'orders',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2024-01',
            identifier: 'id-a',
          },
        ],
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [{topic: 'orders', uri: 'https://example.com/a', actions: ['create']}],
      },
    })
  })

  test('keeps a subscription api_version that overrides the events default', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders',
          uri: 'https://example.com/a',
          actions: ['create'],
          api_version: '2025-07',
          identifier: 'id-a',
        },
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2025-07',
            handle: 'orders-create',
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
            topic: 'orders',
            uri: 'https://example.com/a',
            actions: ['create'],
            api_version: '2024-01',
            identifier: 'id-a',
          },
        ],
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toStrictEqual({
      events: {
        subscription: [{topic: 'orders', uri: 'https://example.com/a', actions: ['create'], api_version: '2024-01'}],
      },
    })
  })

  test('derives a handle from the topic and actions of a single subscription', () => {
    const remoteContent = {
      events: {
        api_version: '2024-01',
        subscription: {
          topic: 'orders',
          uri: 'https://example.com/webhook',
          actions: ['create'],
          identifier: 'id-1',
        },
      },
    }

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            topic: 'orders',
            uri: 'https://example.com/webhook',
            actions: ['create'],
            handle: 'orders-create',
          },
        ],
      },
    })
  })

  test('uses the module handle for a single subscription without one', () => {
    const remoteContent = {events: {subscription: {topic: 'orders', actions: ['create']}}}

    const result = transformToEventsConfig(remoteContent, {handle: 'order-notifier'})

    expect(result).toEqual({
      events: {subscription: [{topic: 'orders', actions: ['create'], handle: 'order-notifier'}]},
    })
  })

  test('prefers the module handle over a legacy subscription handle', () => {
    const remoteContent = {events: {subscription: {topic: 'orders', actions: ['create'], handle: 'from-config'}}}

    const result = transformToEventsConfig(remoteContent, {handle: 'from-module'})

    expect(result).toEqual({
      events: {subscription: [{topic: 'orders', actions: ['create'], handle: 'from-module'}]},
    })
  })

  test('falls back to the subscription handle when no module handle is given', () => {
    const remoteContent = {events: {subscription: {topic: 'orders', actions: ['create'], handle: 'from-config'}}}

    const result = transformToEventsConfig(remoteContent)

    expect(result).toEqual({
      events: {subscription: [{topic: 'orders', actions: ['create'], handle: 'from-config'}]},
    })
  })

  test('ignores the module handle for subscriptions in an array', () => {
    const remoteContent = {events: {subscription: [{topic: 'orders', actions: ['create'], handle: 'order-notifier'}]}}

    const result = transformToEventsConfig(remoteContent, {handle: 'events'})

    expect(result).toEqual({
      events: {subscription: [{topic: 'orders', actions: ['create'], handle: 'order-notifier'}]},
    })
  })

  test.each([49, 50])('limits the generated handle for a topic with %i characters', (topicLength) => {
    const topic = 'a'.repeat(topicLength)

    const result = transformToEventsConfig({events: {subscription: {topic, actions: ['create']}}})

    expect(result).toEqual({events: {subscription: [{topic, actions: ['create'], handle: topic}]}})
  })

  test('includes multiple actions in the generated handle', () => {
    const result = transformToEventsConfig({events: {subscription: {topic: 'orders', actions: ['create', 'paid']}}})

    expect(result).toEqual({
      events: {subscription: [{topic: 'orders', actions: ['create', 'paid'], handle: 'orders-create-paid'}]},
    })
  })
})

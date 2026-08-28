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
        subscription: undefined,
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

    const merged = deepMergeObjects(transformToEventsConfig(moduleOne), transformToEventsConfig(moduleTwo))

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

    const merged = deepMergeObjects(transformToEventsConfig(listModule), transformToEventsConfig(singleModule))

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

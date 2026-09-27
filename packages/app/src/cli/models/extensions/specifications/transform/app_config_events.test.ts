import {transformToEventsConfig, transformFromEventsConfig} from './app_config_events.js'
import {describe, expect, test} from 'vitest'

describe('transformFromEventsConfig', () => {
  test('inherits missing subscription versions while preserving explicit versions and the local config', () => {
    const content = {
      events: {
        api_version: '2026-07',
        subscription: [
          {handle: 'inherited', uri: 'https://example.com/events'},
          {handle: 'explicit-default', uri: 'https://example.com/events', api_version: '2026-07'},
          {handle: 'explicit-override', uri: 'https://example.com/events', api_version: '2026-04'},
        ],
      },
    }
    const originalContent = structuredClone(content)

    const result = transformFromEventsConfig(content)

    expect(result).toEqual({
      events: {
        api_version: '2026-07',
        subscription: [
          {handle: 'inherited', uri: 'https://example.com/events', api_version: '2026-07'},
          {handle: 'explicit-default', uri: 'https://example.com/events', api_version: '2026-07'},
          {handle: 'explicit-override', uri: 'https://example.com/events', api_version: '2026-04'},
        ],
      },
    })
    expect(content).toStrictEqual(originalContent)
  })

  test('preserves an empty subscription version for server validation', () => {
    const content = {
      events: {
        api_version: '2026-07',
        subscription: [{uri: 'https://example.com/events', api_version: ''}],
      },
    }

    expect(transformFromEventsConfig(content)).toEqual(content)
  })

  test('returns content as-is when all URIs are absolute', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [
          {api_version: '2024-01', topic: 'orders/create', uri: 'https://example.com', actions: ['create']},
        ],
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
          {api_version: '2024-01', topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']},
          {
            api_version: '2024-01',
            topic: 'products/update',
            uri: 'https://absolute.example.com/webhook',
            actions: ['update'],
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
            api_version: '2024-01',
            topic: 'orders/create',
            uri: 'https://tunnel.example.com/webhooks/orders',
            actions: ['create'],
          },
          {
            api_version: '2024-01',
            topic: 'products/update',
            uri: 'https://absolute.example.com/webhook',
            actions: ['update'],
          },
        ],
      },
    })
  })

  test('returns content as-is when no application_url in config', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{api_version: '2024-01', topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }

    const result = transformFromEventsConfig(content, {})

    expect(result).toEqual(content)
  })

  test('returns content as-is when no appConfiguration provided', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{api_version: '2024-01', topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }

    const result = transformFromEventsConfig(content)

    expect(result).toEqual(content)
  })

  test('handles application_url with trailing slash', () => {
    const content = {
      events: {
        api_version: '2024-01',
        subscription: [{api_version: '2024-01', topic: 'orders/create', uri: '/webhooks/orders', actions: ['create']}],
      },
    }
    const appConfiguration = {application_url: 'https://tunnel.example.com/'}

    const result = transformFromEventsConfig(content, appConfiguration)

    expect(result).toEqual({
      events: {
        api_version: '2024-01',
        subscription: [
          {
            api_version: '2024-01',
            topic: 'orders/create',
            uri: 'https://tunnel.example.com/webhooks/orders',
            actions: ['create'],
          },
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
})

import appEventsSpec from './app_config_events.js'
import {describe, expect, test} from 'vitest'

describe('event module configuration', () => {
  test('moves each subscription handle onto its module, preserves unknown fields and does not change the input', () => {
    const config = {
      events: {
        api_version: '2024-01',
        future_setting: {enabled: true},
        subscription: [
          {handle: 'orders', topic: 'orders/create', future_field: 'value'},
          {handle: 'products', topic: 'products/update'},
        ],
      },
    }
    const original = structuredClone(config)

    expect(appEventsSpec.expandConfig!(config, {flags: []})).toEqual([
      {
        handle: 'orders',
        events: {
          api_version: '2024-01',
          future_setting: {enabled: true},
          subscription: {topic: 'orders/create', future_field: 'value'},
        },
      },
      {
        handle: 'products',
        events: {
          api_version: '2024-01',
          future_setting: {enabled: true},
          subscription: {topic: 'products/update'},
        },
      },
    ])
    expect(config).toEqual(original)
  })

  test('retains the configuration when there is no subscription list', () => {
    const config = {events: {api_version: '2024-01'}}

    expect(appEventsSpec.expandConfig!(config, {flags: []})).toEqual([config])
    expect(appEventsSpec.getIdentity!(config)).toBeUndefined()
    expect(appEventsSpec.getTarget!(config)).toBeUndefined()
  })

  test('derives identity from the module handle of a single subscription', () => {
    const config = {handle: 'orders', events: {api_version: '2024-01', subscription: {topic: 'orders/create'}}}

    expect(appEventsSpec.getIdentity!(config)).toEqual({handle: 'orders', uid: 'orders'})
  })

  test('targets the topic of a single subscription', () => {
    const config = {handle: 'orders', events: {api_version: '2024-01', subscription: {topic: 'orders/create'}}}

    expect(appEventsSpec.getTarget!(config)).toBe('orders/create')
  })

  test('returns no target for a single subscription without a topic', () => {
    const config = {handle: 'orders', events: {api_version: '2024-01', subscription: {}}}

    expect(appEventsSpec.getTarget!(config)).toBeUndefined()
  })

  test.each(['Orders_123', '-orders', 'orders-', 'a'.repeat(50), ' orders_create '])(
    'accepts a valid module handle for a single subscription: %j',
    (handle) => {
      const events = {subscription: {topic: 'orders/create'}}

      expect(appEventsSpec.parseConfigurationObject({handle, events})).toEqual({
        state: 'ok',
        data: {handle: handle.trim(), events},
        errors: undefined,
      })
    },
  )

  test.each([undefined, '', ' ', 42, 'orders/create', 'orders.create', 'orders create', 'a'.repeat(51), 'events'])(
    'rejects an invalid module handle for a single subscription: %j',
    (handle) => {
      const result = appEventsSpec.parseConfigurationObject({handle, events: {subscription: {topic: 'orders/create'}}})

      expect(result.state).toBe('error')
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({path: ['handle']})]))
    },
  )

  test('does not require a module handle for a subscription list', () => {
    const result = appEventsSpec.parseConfigurationObject({events: {subscription: [{handle: 'orders'}]}})

    expect(result.state).toBe('ok')
  })

  test.each(['my_app', 'a'.repeat(51), 'events'])('excludes the app handle %s from a subscription list', (handle) => {
    const events = {subscription: [{handle: 'orders', topic: 'orders/create'}]}
    const config = {handle, events}
    const original = structuredClone(config)

    expect(appEventsSpec.parseConfigurationObject(config)).toEqual({state: 'ok', data: {events}, errors: undefined})
    expect(config).toEqual(original)
  })

  test.each([{}, {events: {api_version: '2024-01'}}, {events: {subscription: []}}])(
    'excludes the app handle when there is no single subscription: %j',
    (config) => {
      expect(appEventsSpec.parseConfigurationObject({handle: 'my_app', ...config})).toEqual({
        state: 'ok',
        data: config,
        errors: undefined,
      })
    },
  )

  test('validates only the fields needed for local identity', () => {
    const config = {handle: 'orders', events: {api_version: 'future', subscription: {unknown_field: true}}}

    const result = appEventsSpec.parseConfigurationObject(config)

    expect(result).toMatchObject({state: 'ok', data: config})
  })

  test('keeps identity stable when subscription content or position changes', () => {
    const first = {handle: 'orders', topic: 'orders/create', uri: '/original'}
    const second = {handle: 'products', topic: 'products/update'}
    const original = appEventsSpec.expandConfig!({events: {subscription: [first, second]}}, {flags: []})
    const reordered = appEventsSpec.expandConfig!(
      {events: {subscription: [second, {...first, uri: '/updated'}]}},
      {flags: []},
    )
    const identities = (configs: object[]) =>
      configs.map((config) => {
        const parsed = appEventsSpec.parseConfigurationObject(config)
        if (parsed.state === 'error') throw new Error('Invalid test configuration')
        return appEventsSpec.getIdentity!(parsed.data)
      })

    expect(identities(reordered)).toEqual(identities(original).reverse())
    expect(identities(original)).toEqual([
      {handle: 'orders', uid: 'orders'},
      {handle: 'products', uid: 'products'},
    ])
  })
})

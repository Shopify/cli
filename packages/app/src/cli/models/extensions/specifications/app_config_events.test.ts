import appEventsSpec from './app_config_events.js'
import {Flag} from '../../../utilities/developer-platform-client.js'
import {describe, expect, test} from 'vitest'

const flags = [Flag.SingleSubscriptionEventsModules]

describe('event module configuration', () => {
  test('preserves unknown event fields and does not change the input', () => {
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

    expect(appEventsSpec.expandConfig!(config, {flags})).toEqual([
      {events: {...config.events, subscription: config.events.subscription[0]}},
      {events: {...config.events, subscription: config.events.subscription[1]}},
    ])
    expect(config).toEqual(original)
  })

  test('retains the legacy configuration when the flag is disabled', () => {
    const config = {events: {subscription: [{topic: 'orders/create'}]}}

    expect(appEventsSpec.expandConfig!(config, {flags: []})).toEqual([config])
    expect(appEventsSpec.getIdentity!(config)).toBeUndefined()
    expect(appEventsSpec.getTarget!(config)).toBeUndefined()
    expect(appEventsSpec.parseConfigurationObject(config).state).toBe('ok')
  })

  test('retains the configuration when there is no subscription list', () => {
    const config = {events: {api_version: '2024-01'}}

    expect(appEventsSpec.expandConfig!(config, {flags})).toEqual([config])
    expect(appEventsSpec.getIdentity!(config)).toBeUndefined()
    expect(appEventsSpec.getTarget!(config)).toBeUndefined()
  })

  test('targets the topic of a single subscription', () => {
    const config = {events: {api_version: '2024-01', subscription: {handle: 'orders', topic: 'orders/create'}}}

    expect(appEventsSpec.getTarget!(config)).toBe('orders/create')
  })

  test('returns no target for a single subscription without a topic', () => {
    const config = {events: {api_version: '2024-01', subscription: {handle: 'orders'}}}

    expect(appEventsSpec.getTarget!(config)).toBeUndefined()
  })

  test.each([undefined, '', ' ', 42, '-orders', 'orders-', 'orders/create', 'a'.repeat(51), 'events'])(
    'rejects an invalid single-subscription handle: %j',
    (handle) => {
      const result = appEventsSpec.parseConfigurationObject({events: {subscription: {handle}}})

      expect(result.state).toBe('error')
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({path: ['events', 'subscription', 'handle']})]),
      )
    },
  )

  test('validates only the fields needed for local identity', () => {
    const config = {events: {api_version: 'future', subscription: {handle: 'orders', unknown_field: true}}}

    const result = appEventsSpec.parseConfigurationObject(config)

    expect(result).toMatchObject({state: 'ok', data: config})
  })

  test('keeps identity stable when subscription content or position changes', () => {
    const first = {handle: 'orders', topic: 'orders/create', uri: '/original'}
    const second = {handle: 'products', topic: 'products/update'}
    const original = appEventsSpec.expandConfig!({events: {subscription: [first, second]}}, {flags})
    const reordered = appEventsSpec.expandConfig!(
      {events: {subscription: [second, {...first, uri: '/updated'}]}},
      {flags},
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

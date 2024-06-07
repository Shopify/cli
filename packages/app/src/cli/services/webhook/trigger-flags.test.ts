import {
  DELIVERY_METHOD,
  deliveryMethodForAddress,
  isAddressAllowedForDeliveryMethod,
  validateAddressMethod,
} from './trigger-flags.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, vi, test} from 'vitest'

const eventbridgeAddress = 'arn:aws:events:us-east-1::event-source/aws.partner/shopify.com/3737297/source'
const pubsubAddress = 'pubsub://topic:subscription'
const remoteHttpAddress = 'https://example.org/api/webhooks'
const localHttpAddress = 'http://localhost:9090/api/webhooks'
const ftpAddress = 'ftp://user:pass@host'

vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')

describe('isAddressAllowedForDeliveryMethod', () => {
  describe('Google Pub Sub', () => {
    test('accepts Google Pub Sub for pubsub: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(pubsubAddress, DELIVERY_METHOD.PUBSUB)

      // Then
      expect(allowed).toBeTruthy()
    })

    test('rejects Google Pub Sub for Non pubsub: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.PUBSUB)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  describe('Amazon Event Bridge', () => {
    test('accepts Amazon Event Bridge for arn:aws:events: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(eventbridgeAddress, DELIVERY_METHOD.EVENTBRIDGE)

      // Then
      expect(allowed).toBeTruthy()
    })

    test('rejects Amazon Event Bridge for Non arn:aws:events: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.EVENTBRIDGE)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  describe('HTTP', () => {
    test('accepts http for localhost addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(localHttpAddress, DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeTruthy()
    })

    test('accepts https for remote addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeTruthy()
    })

    test('rejects http for remote addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod('http://example.org/api/webhooks', DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  test('rejects unknown address formats', async () => {
    // When
    const allowed = isAddressAllowedForDeliveryMethod(ftpAddress, DELIVERY_METHOD.HTTP)

    // Then
    expect(allowed).toBeFalsy()
  })
})

describe('validateAddressMethod', () => {
  test('returns an array with address-method for http', async () => {
    // When Then
    expect(validateAddressMethod('https://example.org', 'http')).toEqual(['https://example.org', 'http'])
  })

  test('returns localhost as the method when http is passed with a localhost address', async () => {
    // When Then
    expect(validateAddressMethod('http://localhost:3000/webhooks', 'http')).toEqual([
      'http://localhost:3000/webhooks',
      'localhost',
    ])
  })

  test('returns an array with address-method for pubsub', async () => {
    // When Then
    expect(validateAddressMethod(pubsubAddress, 'google-pub-sub')).toEqual([pubsubAddress, DELIVERY_METHOD.PUBSUB])
  })

  test('returns an array with address-method for event-bridge', async () => {
    // When Then
    expect(validateAddressMethod(eventbridgeAddress, 'event-bridge')).toEqual([
      eventbridgeAddress,
      DELIVERY_METHOD.EVENTBRIDGE,
    ])
  })

  test('fails when address-method are not compatible', async () => {
    // When Then
    expect(() => {
      validateAddressMethod('https://example.org', 'google-pub-sub')
    }).toThrow(AbortError)
  })
})

describe('deliveryMethodForAddress', () => {
  test('detects a Google Pub Sub address', async () => {
    // When
    const method = deliveryMethodForAddress(pubsubAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.PUBSUB)
  })

  test('detects an Amazon Event Bridge address', async () => {
    // When
    const method = deliveryMethodForAddress(eventbridgeAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.EVENTBRIDGE)
  })

  test('detects a localhost address', async () => {
    // When
    const method = deliveryMethodForAddress(localHttpAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.LOCALHOST)
  })

  test('detects a localhost address case insensitive', async () => {
    // When
    const method = deliveryMethodForAddress(localHttpAddress.toUpperCase())

    // Then
    expect(method).toEqual(DELIVERY_METHOD.LOCALHOST)
  })

  test('detects a remote http address', async () => {
    // When
    const method = deliveryMethodForAddress(remoteHttpAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.HTTP)
  })

  test('detects a remote http address case insensitive', async () => {
    // When
    const method = deliveryMethodForAddress(remoteHttpAddress.toUpperCase())

    // Then
    expect(method).toEqual(DELIVERY_METHOD.HTTP)
  })

  test('returns undefined when not able to identify address type', async () => {
    // When
    const method = deliveryMethodForAddress(ftpAddress)

    // Then
    expect(method).toBeUndefined()
  })
})

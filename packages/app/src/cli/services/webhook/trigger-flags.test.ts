import {DELIVERY_METHOD, isAddressAllowedForDeliveryMethod, validateAddressMethod} from './trigger-flags.js'
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
  test('returns an array with address-method when they are valid', async () => {
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

  test('fails when address-method are not compatible', async () => {
    // When Then
    expect(() => {
      validateAddressMethod('https://example.org', 'google-pub-sub')
    }).toThrow(AbortError)
  })
})

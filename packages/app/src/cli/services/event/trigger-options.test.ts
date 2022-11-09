import {DELIVERY_METHOD, isAddressAllowedForDeliveryMethod, deliveryMethodForAddress} from './trigger-options.js'
import {describe, expect, it} from 'vitest'

const eventbridgeAddress = 'arn:aws:events:us-east-1::event-source/aws.partner/shopify.com/3737297/source'
const pubsubAddress = 'pubsub://topic:subscription'
const remoteHttpAddress = 'https://example.org/api/webhooks'
const localHttpAddress = 'http://localhost:9090/api/webhooks'
const ftpAddress = 'ftp://user:pass@host'

describe('deliveryMethodForAddress', () => {
  it('detects a Google Pub Sub address', async () => {
    // When
    const method = deliveryMethodForAddress(pubsubAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.PUBSUB)
  })

  it('detects an Amazon Event Bridge address', async () => {
    // When
    const method = deliveryMethodForAddress(eventbridgeAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.EVENTBRIDGE)
  })

  it('detects a localhost address', async () => {
    // When
    const method = deliveryMethodForAddress(localHttpAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.LOCALHOST)
  })

  it('detects a remote http address', async () => {
    // When
    const method = deliveryMethodForAddress(remoteHttpAddress)

    // Then
    expect(method).toEqual(DELIVERY_METHOD.HTTP)
  })

  it('returns undefined when not able to identify address type', async () => {
    // When
    const method = deliveryMethodForAddress(ftpAddress)

    // Then
    expect(method).toBeUndefined()
  })
})

describe('isAddressAllowedForDeliveryMethod', () => {
  describe('Google Pub Sub', () => {
    it('accepts Google Pub Sub for pubsub: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(pubsubAddress, DELIVERY_METHOD.PUBSUB)

      // Then
      expect(allowed).toBeTruthy()
    })

    it('rejects Google Pub Sub for Non pubsub: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.PUBSUB)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  describe('Amazon Event Bridge', () => {
    it('accepts Amazon Event Bridge for arn:aws:events: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(eventbridgeAddress, DELIVERY_METHOD.EVENTBRIDGE)

      // Then
      expect(allowed).toBeTruthy()
    })

    it('rejects Amazon Event Bridge for Non arn:aws:events: addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.EVENTBRIDGE)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  describe('HTTP', () => {
    it('accepts http for localhost addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(localHttpAddress, DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeTruthy()
    })

    it('accepts https for remote addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod(remoteHttpAddress, DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeTruthy()
    })

    it('rejects http for remote addresses', async () => {
      // When
      const allowed = isAddressAllowedForDeliveryMethod('http://example.org/api/webhooks', DELIVERY_METHOD.HTTP)

      // Then
      expect(allowed).toBeFalsy()
    })
  })

  it('rejects unknown address formats', async () => {
    // When
    const allowed = isAddressAllowedForDeliveryMethod(ftpAddress, DELIVERY_METHOD.HTTP)

    // Then
    expect(allowed).toBeFalsy()
  })
})

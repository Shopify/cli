import {
  DELIVERY_METHOD,
  isAddressAllowedForDeliveryMethod,
  deliveryMethodForAddress,
  validateAddressMethod,
  parseVersionAndTopic,
  parseAddressAndMethod,
} from './trigger-flags.js'
import {requestApiVersions} from './request-api-versions.js'
import {requestTopics} from './request-topics.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, vi, test} from 'vitest'

const eventbridgeAddress = 'arn:aws:events:us-east-1::event-source/aws.partner/shopify.com/3737297/source'
const pubsubAddress = 'pubsub://topic:subscription'
const remoteHttpAddress = 'https://example.org/api/webhooks'
const localHttpAddress = 'http://localhost:9090/api/webhooks'
const ftpAddress = 'ftp://user:pass@host'

const developerPlatformClient = testDeveloperPlatformClient()

vi.mock('./request-api-versions.js')
vi.mock('./request-topics.js')

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
  test('validateAddressMethod a valid address-method pair', async () => {
    // When Then
    expect(validateAddressMethod('https://example.org', 'http')).toEqual(true)
  })

  test('fails when address-method are not compatible', async () => {
    // When Then
    expect(() => {
      validateAddressMethod('https://example.org', 'google-pub-sub')
    }).toThrow(AbortError)
  })
})

describe('parseVersionAndTopic', () => {
  test('ignores when no flags', async () => {
    // When
    const got = await parseVersionAndTopic(developerPlatformClient, {})

    // Then
    expect(got).toEqual([undefined, undefined])
  })

  test('gets topic when no version', async () => {
    // When
    const got = await parseVersionAndTopic(developerPlatformClient, {topic: 'topic'})

    // Then
    expect(got).toEqual([undefined, 'topic'])
  })

  test('validates the version', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])

    // When
    const got = await parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable'})

    // Then
    expect(got).toEqual(['unstable', undefined])
  })

  test('fails when version not valid', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])

    // When Then
    await expect(parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unknown'})).rejects.toThrow(AbortError)
  })

  test('validates the version and topic', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'products/delete'])

    // When
    const got = await parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'shop/redact'})

    // Then
    expect(got).toEqual(['unstable', 'shop/redact'])
  })

  test('fails when no topics', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(requestTopics).mockResolvedValue([])

    // When then
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'shop/redact'}),
    ).rejects.toThrow(AbortError)
  })

  test('validates the version and GraphQL-like topic', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create', 'products/delete'])

    // When
    const got = await parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'ORDERS_CREATE'})

    // Then
    expect(got).toEqual(['unstable', 'orders/create'])
  })

  test('fails when topic not present for api-version topics list', async () => {
    // Given
    vi.mocked(requestApiVersions).mockResolvedValue(['2023-01', 'unstable'])
    vi.mocked(requestTopics).mockResolvedValue(['shop/redact', 'orders/create', 'products/delete'])

    // Then when
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'unknown'}),
    ).rejects.toThrow(AbortError)
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'OrdERS_Create'}),
    ).rejects.toThrow(AbortError)
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'orders_create'}),
    ).rejects.toThrow(AbortError)
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'OrdERS/CreaTE'}),
    ).rejects.toThrow(AbortError)
    await expect(
      parseVersionAndTopic(developerPlatformClient, {apiVersion: 'unstable', topic: 'ORDERS/CREATE'}),
    ).rejects.toThrow(AbortError)
  })
})

describe('parseAddressAndMethod', () => {
  test('ignores when no flags', async () => {
    // When
    const got = parseAddressAndMethod({})

    // Then
    expect(got).toEqual([undefined, undefined])
  })

  test('gets method from method only', async () => {
    // Then
    expect(parseAddressAndMethod({deliveryMethod: 'http'})).toEqual(['http', undefined])
    expect(parseAddressAndMethod({deliveryMethod: 'event-bridge'})).toEqual(['event-bridge', undefined])
    expect(parseAddressAndMethod({deliveryMethod: 'google-pub-sub'})).toEqual(['google-pub-sub', undefined])
  })

  test('fails when method is unknown', async () => {
    // Then
    expect(() => {
      parseAddressAndMethod({deliveryMethod: 'ftp'})
    }).toThrow(AbortError)
  })

  test('gets pair from address', async () => {
    // When
    const got = parseAddressAndMethod({address: 'http://localhost'})

    // Then
    expect(got).toEqual(['localhost', 'http://localhost'])
  })

  test('fails when address is not accepted', async () => {
    // When
    expect(() => {
      parseAddressAndMethod({address: 'ftp://example.org'})
    }).toThrow(AbortError)
  })

  test('gets transformed pair from pair', async () => {
    // When
    const got = parseAddressAndMethod({deliveryMethod: 'http', address: 'http://localhost'})

    // Then
    expect(got).toEqual(['localhost', 'http://localhost'])
  })

  test('gets untransformed pair from pair', async () => {
    // When
    const got = parseAddressAndMethod({deliveryMethod: 'http', address: 'https://example.org'})

    // Then
    expect(got).toEqual(['http', 'https://example.org'])
  })
})

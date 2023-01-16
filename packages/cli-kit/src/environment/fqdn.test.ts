import {partners, shopify, identity, NotProvidedStoreFQDNError, normalizeStoreName} from './fqdn.js'
import {Environment, isSpinEnvironment, serviceEnvironment} from './service.js'
import {spinFqdn} from '../public/node/environment/spin.js'
import {expect, describe, test, vi} from 'vitest'

vi.mock('../public/node/environment/spin.js')
vi.mock('./service')

describe('partners', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await partners()

    // Then
    expect(got).toEqual('partners.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await partners()

    // Then
    expect(got).toEqual('partners.shopify.com')
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Spin)
    vi.mocked(spinFqdn).mockResolvedValue('spin.com')

    // When
    const got = await partners()

    // Then
    expect(got).toEqual('partners.spin.com')
  })
})

describe('identity', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await identity()

    // Then
    expect(got).toEqual('identity.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await identity()

    // Then
    expect(got).toEqual('accounts.shopify.com')
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Spin)
    vi.mocked(spinFqdn).mockResolvedValue('spin.com')

    // When
    const got = await identity()

    // Then
    expect(got).toEqual('identity.spin.com')
  })
})

describe('shopify', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await shopify({storeFqdn: 'myshop.shopify.com'})

    // Then
    expect(got).toEqual('shopify.myshopify.io')
  })

  test('returns the store fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)
    const storeFqdn = 'myshop.shopify.com'

    // When
    const got = await shopify({storeFqdn})

    // Then
    expect(got).toEqual(storeFqdn)
  })

  test("throws an error when the environment is production and the store fqdn hasn't been provided", async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When/Then
    await expect(shopify({})).rejects.toThrow(NotProvidedStoreFQDNError)
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Spin)
    vi.mocked(spinFqdn).mockResolvedValue('spin.com')

    // When
    const got = await shopify({})

    // Then
    expect(got).toEqual('identity.spin.com')
  })
})

describe('normalizeStore', () => {
  test('parses store name with http', async () => {
    // When
    const got = await normalizeStoreName('http://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name with https', async () => {
    // When
    const got = await normalizeStoreName('https://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name with https when spin URL', async () => {
    // When
    const got = await normalizeStoreName('https://devstore001.shopify.partners-6xat.test.us.spin.dev')

    // Then
    expect(got).toEqual('devstore001.shopify.partners-6xat.test.us.spin.dev')
  })

  test('parses store name without domain', async () => {
    // When
    const got = await normalizeStoreName('example')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name without domain in spin', async () => {
    // Given
    vi.mocked(isSpinEnvironment).mockReturnValue(true)
    vi.mocked(spinFqdn).mockResolvedValue('mydomain.spin.dev')

    // When
    const got = await normalizeStoreName('example')

    // Then
    expect(got).toEqual('example.shopify.mydomain.spin.dev')
  })
})

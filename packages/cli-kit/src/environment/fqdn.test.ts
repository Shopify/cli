import {
  partners as partnersEnvironment,
  shopify as shopifyEnvironment,
  identity as identityEnvironment,
} from './service.js'
import {partners, shopify, identity, NotProvidedStoreFQDNError} from './fqdn.js'
import {fqdn as spinFqdn} from './spin.js'
import {Environment} from '../network/service.js'
import {expect, describe, test, vi} from 'vitest'

vi.mock('./spin')
vi.mock('./service')

describe('partners', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(partnersEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await partners()

    // Then
    expect(got).toEqual('partners.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(partnersEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await partners()

    // Then
    expect(got).toEqual('partners.shopify.com')
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(partnersEnvironment).mockReturnValue(Environment.Spin)
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
    vi.mocked(identityEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await identity()

    // Then
    expect(got).toEqual('identity.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(identityEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await identity()

    // Then
    expect(got).toEqual('accounts.shopify.com')
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(identityEnvironment).mockReturnValue(Environment.Spin)
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
    vi.mocked(shopifyEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await shopify({storeFqdn: 'myshop.shopify.com'})

    // Then
    expect(got).toEqual('shopify.myshopify.io')
  })

  test('returns the store fqdn when the environment is production', async () => {
    // Given
    vi.mocked(shopifyEnvironment).mockReturnValue(Environment.Production)
    const storeFqdn = 'myshop.shopify.com'

    // When
    const got = await shopify({storeFqdn})

    // Then
    expect(got).toEqual(storeFqdn)
  })

  test("throws an error when the environment is production and the store fqdn hasn't been provided", async () => {
    // Given
    vi.mocked(shopifyEnvironment).mockReturnValue(Environment.Production)

    // When/Then
    await expect(shopify({})).rejects.toThrow(NotProvidedStoreFQDNError)
  })

  test("returns the spin fqdn if the environment is spin and it's running in a Spin environment", async () => {
    // Given
    vi.mocked(shopifyEnvironment).mockReturnValue(Environment.Spin)
    vi.mocked(spinFqdn).mockResolvedValue('spin.com')

    // When
    const got = await shopify({})

    // Then
    expect(got).toEqual('identity.spin.com')
  })
})

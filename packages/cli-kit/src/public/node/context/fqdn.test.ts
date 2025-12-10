import {
  partnersFqdn,
  appManagementFqdn,
  identityFqdn,
  normalizeStoreFqdn,
  businessPlatformFqdn,
  appDevFqdn,
  adminFqdn,
} from './fqdn.js'
import {Environment, serviceEnvironment} from '../../../private/node/context/service.js'
import {expect, describe, test, vi} from 'vitest'

vi.mock('../../../private/node/context/service.js')

vi.mock('../vendor/dev_server/index.js', () => {
  return {
    DevServerCore: class {
      host(serviceName: string) {
        return `${serviceName}.myshopify.io`
      }
    },
    DevServer: class {
      constructor(private readonly serviceName: string) {}
      host() {
        return `${this.serviceName}.myshopify.io`
      }
    },
  }
})

describe('partners', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await partnersFqdn()

    // Then
    expect(got).toEqual('partners.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await partnersFqdn()

    // Then
    expect(got).toEqual('partners.shopify.com')
  })
})

describe('appManagementFqdn', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await appManagementFqdn()

    // Then
    expect(got).toEqual('app.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await appManagementFqdn()

    // Then
    expect(got).toEqual('app.shopify.com')
  })
})

describe('appDevFqdn', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)
    const storeFqdn = 'mystore.myshopify.com'

    // When
    const got = await appDevFqdn(storeFqdn)

    // Then
    expect(got).toEqual('app.myshopify.io')
  })

  test('returns the store fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)
    const storeFqdn = 'mystore.myshopify.com'

    // When
    const got = await appDevFqdn(storeFqdn)

    // Then
    expect(got).toEqual('mystore.myshopify.com')
  })
})

describe('business-platform', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await businessPlatformFqdn()

    // Then
    expect(got).toEqual('business-platform.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await businessPlatformFqdn()

    // Then
    expect(got).toEqual('destinations.shopifysvc.com')
  })
})

describe('identity', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await identityFqdn()

    // Then
    expect(got).toEqual('identity.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await identityFqdn()

    // Then
    expect(got).toEqual('accounts.shopify.com')
  })
})

describe('adminFqdn', () => {
  test('returns the local fqdn when the environment is local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await adminFqdn()

    // Then
    expect(got).toEqual('admin.myshopify.io')
  })

  test('returns the production fqdn when the environment is production', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)

    // When
    const got = await adminFqdn()

    // Then
    expect(got).toEqual('admin.shopify.com')
  })
})

describe('normalizeStore', () => {
  test('parses store name with http', async () => {
    // When
    const got = await normalizeStoreFqdn('http://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name with https', async () => {
    // When
    const got = await normalizeStoreFqdn('https://example.myshopify.com')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name without domain', async () => {
    // When
    const got = await normalizeStoreFqdn('example')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })

  test('parses store name without domain in local', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)

    // When
    const got = await normalizeStoreFqdn('example')

    // Then
    expect(got).toEqual('example.myshopify.io')
  })

  test('parses store name with admin', async () => {
    // When
    const got = await normalizeStoreFqdn('https://example.myshopify.com/admin/')

    // Then
    expect(got).toEqual('example.myshopify.com')
  })
})

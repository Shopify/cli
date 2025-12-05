import {createAdminSessionAsApp, validateSingleOperation, validateApiVersion} from './common.js'
import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {supportedApiVersions} from '@shopify/cli-kit/node/api/admin'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/session')
  return {
    ...actual,
    ensureAuthenticatedAdminAsApp: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/api/admin', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/api/admin')
  return {
    ...actual,
    supportedApiVersions: vi.fn(),
  }
})

describe('createAdminSessionAsApp', () => {
  const mockRemoteApp = {
    apiKey: 'test-api-key',
    apiSecretKeys: [{secret: 'test-api-secret'}],
    title: 'Test App',
  } as OrganizationApp

  const storeFqdn = 'test-store.myshopify.com'
  const mockAdminSession = {token: 'test-token', storeFqdn}

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue(mockAdminSession)
  })

  test('creates admin session with app credentials', async () => {
    const session = await createAdminSessionAsApp(mockRemoteApp, storeFqdn)

    expect(ensureAuthenticatedAdminAsApp).toHaveBeenCalledWith(
      storeFqdn,
      mockRemoteApp.apiKey,
      mockRemoteApp.apiSecretKeys[0]!.secret,
    )
    expect(session).toEqual(mockAdminSession)
  })

  test('throws BugError when app has no API secret keys', async () => {
    const appWithoutSecret = {
      ...mockRemoteApp,
      apiSecretKeys: [],
    } as OrganizationApp

    await expect(createAdminSessionAsApp(appWithoutSecret, storeFqdn)).rejects.toThrow(
      'No API secret keys found for app',
    )

    expect(ensureAuthenticatedAdminAsApp).not.toHaveBeenCalled()
  })
})

describe('validateSingleOperation', () => {
  test('accepts valid query operation', () => {
    const query = 'query { shop { name } }'

    expect(() => validateSingleOperation(query)).not.toThrow()
  })

  test('accepts valid mutation operation', () => {
    const mutation = 'mutation { productUpdate(input: {}) { product { id } } }'

    expect(() => validateSingleOperation(mutation)).not.toThrow()
  })

  test('accepts query with shorthand syntax', () => {
    const query = '{ shop { name } }'

    expect(() => validateSingleOperation(query)).not.toThrow()
  })

  test('throws on malformed GraphQL syntax', () => {
    const malformedQuery = '{ shop { name }'

    expect(() => validateSingleOperation(malformedQuery)).toThrow('Syntax Error')
  })

  test('throws when GraphQL document contains multiple operations', () => {
    // eslint-disable-next-line @shopify/cli/no-inline-graphql
    const multipleOperations = `
      query GetShop { shop { name } }
      mutation UpdateProduct { productUpdate(input: {}) { product { id } } }
    `

    expect(() => validateSingleOperation(multipleOperations)).toThrow('must contain exactly one operation definition')
  })

  test('throws when GraphQL document contains no operations', () => {
    const fragmentOnly = `
      fragment ProductFields on Product {
        id
        title
      }
    `

    expect(() => validateSingleOperation(fragmentOnly)).toThrow('must contain exactly one operation definition')
  })
})

describe('validateApiVersion', () => {
  const mockAdminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}

  test('allows unstable version without validation', async () => {
    await expect(validateApiVersion(mockAdminSession, 'unstable')).resolves.not.toThrow()

    expect(supportedApiVersions).not.toHaveBeenCalled()
  })

  test('allows supported API version', async () => {
    vi.mocked(supportedApiVersions).mockResolvedValue(['2024-01', '2024-04', '2024-07'])

    await expect(validateApiVersion(mockAdminSession, '2024-04')).resolves.not.toThrow()

    expect(supportedApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('throws error when API version is not supported', async () => {
    vi.mocked(supportedApiVersions).mockResolvedValue(['2024-01', '2024-04', '2024-07'])

    await expect(validateApiVersion(mockAdminSession, '2023-01')).rejects.toThrow('Invalid API version: 2023-01')

    expect(supportedApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })
})

import {createAdminSessionAsApp, validateSingleOperation} from './common.js'
import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/session', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/session')
  return {
    ...actual,
    ensureAuthenticatedAdminAsApp: vi.fn(),
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

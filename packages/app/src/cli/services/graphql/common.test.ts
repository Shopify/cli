import {createAdminSessionAsApp, formatOperationInfo, resolveApiVersion, validateSingleOperation} from './common.js'
import {OrganizationApp} from '../../models/organization.js'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {fetchApiVersions} from '@shopify/cli-kit/node/api/admin'
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
    fetchApiVersions: vi.fn(),
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

describe('resolveApiVersion', () => {
  const mockAdminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}

  test('returns unstable version without validation', async () => {
    const result = await resolveApiVersion({adminSession: mockAdminSession, userSpecifiedVersion: 'unstable'})

    expect(result).toBe('unstable')
    expect(fetchApiVersions).not.toHaveBeenCalled()
  })

  test('returns user-provided version when allowed', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2024-01', supported: true},
      {handle: '2024-04', supported: true},
      {handle: '2024-07', supported: true},
    ])

    const result = await resolveApiVersion({
      adminSession: mockAdminSession,
      userSpecifiedVersion: '2024-04',
      minimumDefaultVersion: '2026-01',
    })

    expect(result).toBe('2024-04')
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('returns user-provided version even when marked as unsupported', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2024-01', supported: true},
      {handle: '2024-04', supported: false},
      {handle: '2024-07', supported: true},
    ])

    const result = await resolveApiVersion({adminSession: mockAdminSession, userSpecifiedVersion: '2024-04'})

    expect(result).toBe('2024-04')
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('throws error when user-provided version is not in API version list', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2024-01', supported: true},
      {handle: '2024-04', supported: true},
      {handle: '2024-07', supported: true},
    ])

    await expect(resolveApiVersion({adminSession: mockAdminSession, userSpecifiedVersion: '2023-01'})).rejects.toThrow(
      'Invalid API version: 2023-01',
    )
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('returns most recent supported version when no version or minimum version provided', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2024-01', supported: true},
      {handle: '2024-04', supported: true},
      {handle: '2024-07', supported: true},
      {handle: '2025-01', supported: false},
    ])

    const result = await resolveApiVersion({adminSession: mockAdminSession})

    expect(result).toBe('2024-07')
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('returns minimum version when no version provided and most recent supported is older', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2024-01', supported: true},
      {handle: '2024-04', supported: true},
      {handle: '2025-01', supported: false},
      {handle: '2025-10', supported: true},
    ])

    const result = await resolveApiVersion({adminSession: mockAdminSession, minimumDefaultVersion: '2026-01'})

    expect(result).toBe('2026-01')
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })

  test('returns most recent supported version when newer than minimum version', async () => {
    vi.mocked(fetchApiVersions).mockResolvedValue([
      {handle: '2026-01', supported: true},
      {handle: '2026-04', supported: true},
      {handle: '2026-07', supported: true},
      {handle: '2027-01', supported: false},
    ])

    const result = await resolveApiVersion({adminSession: mockAdminSession, minimumDefaultVersion: '2026-01'})

    expect(result).toBe('2026-07')
    expect(fetchApiVersions).toHaveBeenCalledWith(mockAdminSession)
  })
})

describe('formatOperationInfo', () => {
  const mockOptions = {
    organization: {businessName: 'Test Organization'},
    remoteApp: {title: 'Test App'},
    storeFqdn: 'test-store.myshopify.com',
  }

  test('includes API version when provided', () => {
    const result = formatOperationInfo({
      ...mockOptions,
      version: '2024-07',
    })

    expect(result).toEqual([
      'Organization: Test Organization',
      'App: Test App',
      'Store: test-store.myshopify.com',
      'API version: 2024-07',
    ])
  })

  test('omits API version when not provided', () => {
    const result = formatOperationInfo(mockOptions)

    expect(result).toEqual(['Organization: Test Organization', 'App: Test App', 'Store: test-store.myshopify.com'])
    expect(result).not.toContain(expect.stringContaining('API version'))
  })
})

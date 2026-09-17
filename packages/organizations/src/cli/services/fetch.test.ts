import {fetchOrganizationById, fetchOrganizations, fetchOrganizationsWithAccessInfo} from './fetch.js'
import {describe, expect, test, vi} from 'vitest'
import {businessPlatformRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform, lastSeenUserId} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const ENCODED_GID_1 = Buffer.from('gid://organization/Organization/1234').toString('base64')
const ENCODED_GID_2 = Buffer.from('gid://organization/Organization/5678').toString('base64')

const NODE_1 = {
  id: ENCODED_GID_1,
  name: 'My Org',
  status: 'ACTIVE' as const,
  shopCount: 3,
  url: 'https://admin.shopify.com/organization/1234',
}
const NODE_2 = {
  id: ENCODED_GID_2,
  name: 'Other Org',
  status: 'LOCKED' as const,
  shopCount: null,
  url: 'https://admin.shopify.com/organization/5678',
}

describe('fetchOrganizations', () => {
  test('returns organizations with decoded numeric IDs and public destination fields', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1, NODE_2],
        },
      },
    })

    const orgs = await fetchOrganizations()

    expect(orgs).toEqual([
      {
        id: '1234',
        businessName: 'My Org',
        status: 'ACTIVE',
        shopCount: 3,
        url: 'https://admin.shopify.com/organization/1234',
      },
      {
        id: '5678',
        businessName: 'Other Org',
        status: 'LOCKED',
        shopCount: null,
        url: 'https://admin.shopify.com/organization/5678',
      },
    ])
  })

  test('returns empty array when no currentUserAccount is returned', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: null,
    })

    const orgs = await fetchOrganizations()
    expect(orgs).toEqual([])
  })

  test('returns empty array when organizations list is empty', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [],
        },
      },
    })

    const orgs = await fetchOrganizations()
    expect(orgs).toEqual([])
  })

  test('passes token and unauthorized handler to businessPlatformRequestDoc', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1],
        },
      },
    })

    await fetchOrganizations()

    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        unauthorizedHandler: expect.objectContaining({
          type: 'token_refresh',
        }),
      }),
    )
  })
})

describe('fetchOrganizationsWithAccessInfo', () => {
  test('uses a provided token without re-authenticating', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockClear()
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1],
        },
      },
    })

    await fetchOrganizationsWithAccessInfo('pre-resolved-token')

    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(expect.objectContaining({token: 'pre-resolved-token'}))
  })

  test('refreshes a provided token on unauthorized without authenticating before the first request', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('refreshed-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1],
        },
      },
    })

    await fetchOrganizationsWithAccessInfo('pre-resolved-token')

    const requestOptions = vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0] as any
    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    await expect(requestOptions.unauthorizedHandler.handler()).resolves.toEqual({token: 'refreshed-token'})
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledOnce()
  })

  test('refreshes ambient local auth on unauthorized when no token is provided', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform)
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce('refreshed-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1],
        },
      },
    })

    await fetchOrganizationsWithAccessInfo()

    const requestOptions = vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0] as any
    await expect(requestOptions.unauthorizedHandler.handler()).resolves.toEqual({token: 'refreshed-token'})
    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(expect.objectContaining({token: 'initial-token'}))
  })

  test('returns organizations plus current-user metadata when the session resolves to a user', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {
        uuid: 'user-uuid',
        email: 'merchant@example.com',
        organizationsWithAccessToDestination: {
          nodes: [NODE_1],
        },
      },
    })

    const result = await fetchOrganizationsWithAccessInfo()

    expect(result).toEqual({
      organizations: [
        {
          id: '1234',
          businessName: 'My Org',
          status: 'ACTIVE',
          shopCount: 3,
          url: 'https://admin.shopify.com/organization/1234',
        },
      ],
      currentUserResolved: true,
    })
  })

  test('returns unresolved current-user metadata when BP cannot resolve currentUserAccount', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: null,
    })

    const result = await fetchOrganizationsWithAccessInfo()

    expect(result).toEqual({
      organizations: [],
      currentUserResolved: false,
    })
  })
})

describe('fetchOrganizationById', () => {
  test('returns the organization for a numeric ID, addressed by its encoded GID', async () => {
    vi.mocked(lastSeenUserId).mockResolvedValue('account-1')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    const organization = await fetchOrganizationById('1234', 'test-token')

    expect(organization).toEqual({id: '1234', businessName: 'My Org'})
    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'test-token',
        variables: {organizationId: ENCODED_GID_1},
        // Scoped by account: the cache is shared across every account on the machine.
        cacheOptions: {cacheTTL: {hours: 6}, cacheExtraKey: 'account-1'},
      }),
    )
  })

  test('keys the cache separately for each account', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    vi.mocked(lastSeenUserId).mockResolvedValue('account-1')
    await fetchOrganizationById('1234', 'test-token')
    vi.mocked(lastSeenUserId).mockResolvedValue('account-2')
    await fetchOrganizationById('1234', 'test-token')

    const [first, second] = vi.mocked(businessPlatformRequestDoc).mock.calls
    expect((first?.[0] as any).cacheOptions.cacheExtraKey).toBe('account-1')
    expect((second?.[0] as any).cacheOptions.cacheExtraKey).toBe('account-2')
  })

  test('skips caching entirely when the account cannot be identified', async () => {
    vi.mocked(lastSeenUserId).mockResolvedValue('unknown')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    await fetchOrganizationById('1234', 'test-token')

    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(expect.objectContaining({cacheOptions: undefined}))
  })

  test('accepts an organization GID and requests the same encoded ID', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    const organization = await fetchOrganizationById('gid://organization/Organization/1234', 'test-token')

    expect(organization).toEqual({id: 'gid://organization/Organization/1234', businessName: 'My Org'})
    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({variables: {organizationId: ENCODED_GID_1}}),
    )
  })

  test('returns undefined when the account cannot reach an organization with that ID', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({currentUserAccount: {organization: null}})

    await expect(fetchOrganizationById('9999999', 'test-token')).resolves.toBeUndefined()
  })

  test('returns undefined when BP cannot resolve currentUserAccount', async () => {
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({currentUserAccount: null})

    await expect(fetchOrganizationById('1234', 'test-token')).resolves.toBeUndefined()
  })

  test('throws without requesting anything when the ID is not numeric', async () => {
    await expect(fetchOrganizationById('not-an-id', 'test-token')).rejects.toThrow('Invalid organization ID: not-an-id')
    expect(businessPlatformRequestDoc).not.toHaveBeenCalled()
  })

  test('fetches a token when none is provided, and refreshes it on an unauthorized response', async () => {
    vi.mocked(ensureAuthenticatedBusinessPlatform)
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce('refreshed-token')
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    await fetchOrganizationById('1234')

    const requestOptions = vi.mocked(businessPlatformRequestDoc).mock.calls[0]?.[0] as any
    expect(requestOptions.token).toBe('initial-token')
    await expect(requestOptions.unauthorizedHandler.handler()).resolves.toEqual({token: 'refreshed-token'})
  })

  test('uses a caller-provided unauthorized handler instead of the default', async () => {
    const unauthorizedHandler = {type: 'token_refresh' as const, handler: async () => ({token: 'client-token'})}
    vi.mocked(businessPlatformRequestDoc).mockResolvedValue({
      currentUserAccount: {organization: {id: ENCODED_GID_1, name: 'My Org'}},
    })

    await fetchOrganizationById('1234', 'test-token', unauthorizedHandler)

    expect(businessPlatformRequestDoc).toHaveBeenCalledWith(expect.objectContaining({unauthorizedHandler}))
  })
})

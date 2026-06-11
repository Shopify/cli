import {listBusinessPlatformStores} from './bp-source.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const organization = {id: '1234', businessName: 'Acme'}

function shopPage({
  organizationId = '1234',
  shopifyShopId = '1',
  name = 'Acme Production',
  storeType = 'PRODUCTION',
  primaryDomain = 'acme.myshopify.com',
  url = null,
  createdAt = '2026-01-15T00:00:00Z',
  hasNextPage = false,
}: {
  organizationId?: string
  shopifyShopId?: string
  name?: string
  storeType?: string
  primaryDomain?: string | null
  url?: string | null
  createdAt?: string
  hasNextPage?: boolean
} = {}) {
  return {
    organization: {
      id: organizationId,
      name: 'Ignored response org name',
      accessibleShops: {
        edges: [
          {
            node: {
              id: `gid://shopify/Shop/${shopifyShopId}`,
              shopifyShopId,
              name,
              storeType,
              primaryDomain,
              url,
              createdAt,
            },
          },
        ],
        pageInfo: {hasNextPage, endCursor: null},
      },
    },
  }
}

describe('listBusinessPlatformStores', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('fetches active stores for the resolved organization', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage())

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})
    const requestOptions = vi.mocked(businessPlatformOrganizationsRequestDoc).mock.calls[0]?.[0] as any

    expect(JSON.stringify(requestOptions.query)).toContain('STORE_STATUS')
    expect(JSON.stringify(requestOptions.query)).toContain('EQUALS')
    expect(JSON.stringify(requestOptions.query)).toContain('active')
    expect(result).toEqual({
      entries: [
        {
          id: 'gid://shopify/Shop/1',
          store: 'acme.myshopify.com',
          createdAt: '2026-01-15T00:00:00Z',
          organizationId: '1234',
          organizationName: 'Acme',
          name: 'Acme Production',
          type: 'production',
        },
      ],
    })
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({token: 'bp-token', organizationId: '1234', variables: {first: 250}}),
    )
  })

  test('uses the selected organization name instead of the response organization name', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({organizationId: '5678', primaryDomain: 'beta.myshopify.com'}),
    )

    const result = await listBusinessPlatformStores({
      token: 'bp-token',
      organization: {id: '5678', businessName: 'Beta'},
    })

    expect(result.entries[0]?.organizationName).toBe('Beta')
  })

  test('skips accessible shops that have no URL or primary domain', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({primaryDomain: null, url: null, name: 'Missing Domain Shop'}),
    )

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result).toEqual({entries: []})
  })

  test('fetches a single bounded page for the selected organization and orders newest first', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue({
      organization: {
        id: '1234',
        name: 'Acme',
        accessibleShops: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Shop/1',
                shopifyShopId: '1',
                name: 'Older Shop',
                storeType: 'PRODUCTION',
                primaryDomain: 'older.myshopify.com',
                url: null,
                createdAt: '2025-01-01T00:00:00Z',
              },
            },
            {
              node: {
                id: 'gid://shopify/Shop/2',
                shopifyShopId: '2',
                name: 'Newer Shop',
                storeType: 'DEVELOPMENT',
                primaryDomain: 'newer.myshopify.com',
                url: null,
                createdAt: '2026-05-01T00:00:00Z',
              },
            },
          ],
          pageInfo: {hasNextPage: false},
        },
      },
    } as any)

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result.entries.map((entry) => entry.store)).toEqual(['newer.myshopify.com', 'older.myshopify.com'])
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(1)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({variables: {first: 250}}),
    )
  })

  test('sorts stores with matching created dates by store host', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue({
      organization: {
        id: '1234',
        name: 'Acme',
        accessibleShops: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Shop/2',
                shopifyShopId: '2',
                name: 'B Shop',
                storeType: 'DEVELOPMENT',
                primaryDomain: 'b-shop.myshopify.com',
                url: null,
                createdAt: '2026-05-01T00:00:00Z',
              },
            },
            {
              node: {
                id: 'gid://shopify/Shop/1',
                shopifyShopId: '1',
                name: 'A Shop',
                storeType: 'DEVELOPMENT',
                primaryDomain: 'a-shop.myshopify.com',
                url: null,
                createdAt: '2026-05-01T00:00:00Z',
              },
            },
          ],
          pageInfo: {hasNextPage: false},
        },
      },
    } as any)

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result.entries.map((entry) => entry.store)).toEqual(['a-shop.myshopify.com', 'b-shop.myshopify.com'])
  })

  test('reports hasMore when the selected organization has more stores than the fetched page', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage({hasNextPage: true}))

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result.hasMore).toBe(true)
  })

  test('raises the underlying error when the selected organization listing fails', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(
      new AbortError('Access denied for accessibleShops'),
    )

    await expect(listBusinessPlatformStores({token: 'bp-token', organization})).rejects.toThrow(
      'Access denied for accessibleShops',
    )
  })

  test('refreshes the Business Platform token when the store request is unauthorized', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage())
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('refreshed-token')

    await listBusinessPlatformStores({token: 'bp-token', organization})

    const requestOptions = vi.mocked(businessPlatformOrganizationsRequestDoc).mock.calls[0]?.[0] as any
    await requestOptions.unauthorizedHandler.handler()

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith()
  })
})

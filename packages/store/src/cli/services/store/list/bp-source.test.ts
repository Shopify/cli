import {listBusinessPlatformStores} from './bp-source.js'
import {type ListAccessibleShopsQuery} from '../../../api/graphql/business-platform-organizations/generated/list_accessible_shops.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {type Organization} from '@shopify/organizations'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const organization: Organization = {id: '1234', businessName: 'Acme'}

type AccessibleShops = NonNullable<NonNullable<ListAccessibleShopsQuery['organization']>['accessibleShops']>
type AccessibleShopNode = AccessibleShops['edges'][number]['node']

function accessibleShopNode(overrides: Partial<AccessibleShopNode> = {}): AccessibleShopNode {
  return {
    id: 'gid://shopify/Shop/1',
    shopifyShopId: '1',
    name: 'Acme Production',
    storeType: 'PRODUCTION',
    planName: 'shopify_plus',
    primaryDomain: 'acme.myshopify.com',
    url: null,
    createdAt: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

function shopPage({
  organizationId = '1234',
  shops = [accessibleShopNode()],
  hasNextPage = false,
}: {
  organizationId?: string
  shops?: AccessibleShopNode[]
  hasNextPage?: boolean
} = {}): ListAccessibleShopsQuery {
  return {
    organization: {
      id: organizationId,
      name: 'Ignored response org name',
      accessibleShops: {
        edges: shops.map((node) => ({node})),
        pageInfo: {hasNextPage},
      },
    },
  }
}

function latestBusinessPlatformRequestOptions() {
  const [requestOptions] = vi.mocked(businessPlatformOrganizationsRequestDoc).mock.calls[0] ?? []
  if (!requestOptions) throw new Error('Expected a Business Platform request')
  return requestOptions
}

describe('listBusinessPlatformStores', () => {
  beforeEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('fetches active stores for the resolved organization', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage())

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

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
          plan: 'plus',
        },
      ],
      hasMore: false,
    })
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'bp-token',
        organizationId: '1234',
        variables: {
          first: 250,
          filters: [{field: 'STORE_STATUS', operator: 'EQUALS', value: 'active'}],
          search: undefined,
        },
      }),
    )
  })

  test('narrows the query to one store type when the caller asks for it', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage())

    await listBusinessPlatformStores({token: 'bp-token', organization, storeTypeFilter: 'development_superset'})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          first: 250,
          filters: [
            {field: 'STORE_STATUS', operator: 'EQUALS', value: 'active'},
            {field: 'STORE_TYPE', operator: 'EQUALS', value: 'development_superset'},
          ],
          search: undefined,
        },
      }),
    )
  })

  test('passes a search term through to the query', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(shopPage())

    await listBusinessPlatformStores({token: 'bp-token', organization, searchTerm: 'acme'})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({variables: expect.objectContaining({search: 'acme'})}),
    )
  })

  test('uses the selected organization name instead of the response organization name', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({organizationId: '5678', shops: [accessibleShopNode({primaryDomain: 'beta.myshopify.com'})]}),
    )

    const result = await listBusinessPlatformStores({
      token: 'bp-token',
      organization: {id: '5678', businessName: 'Beta'},
    })

    expect(result.entries[0]?.organizationName).toBe('Beta')
  })

  test('skips accessible shops that have no URL or primary domain', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({shops: [accessibleShopNode({primaryDomain: null, url: null, name: 'Missing Domain Shop'})]}),
    )

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result).toEqual({entries: [], hasMore: false})
  })

  test('omits the plan for an unrecognized plan name', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({shops: [accessibleShopNode({planName: 'some_new_plan'})]}),
    )

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result.entries[0]?.plan).toBeUndefined()
  })

  test('fetches a single bounded page for the selected organization and orders newest first', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({
        shops: [
          accessibleShopNode({
            shopifyShopId: '1',
            name: 'Older Shop',
            storeType: 'PRODUCTION',
            primaryDomain: 'older.myshopify.com',
            createdAt: '2025-01-01T00:00:00Z',
          }),
          accessibleShopNode({
            id: 'gid://shopify/Shop/2',
            shopifyShopId: '2',
            name: 'Newer Shop',
            storeType: 'DEVELOPMENT',
            primaryDomain: 'newer.myshopify.com',
            createdAt: '2026-05-01T00:00:00Z',
          }),
        ],
      }),
    )

    const result = await listBusinessPlatformStores({token: 'bp-token', organization})

    expect(result.entries.map((entry) => entry.store)).toEqual(['newer.myshopify.com', 'older.myshopify.com'])
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(1)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          first: 250,
          filters: [{field: 'STORE_STATUS', operator: 'EQUALS', value: 'active'}],
          search: undefined,
        },
      }),
    )
  })

  test('sorts stores with matching created dates by store host', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(
      shopPage({
        shops: [
          accessibleShopNode({
            id: 'gid://shopify/Shop/2',
            shopifyShopId: '2',
            name: 'B Shop',
            storeType: 'DEVELOPMENT',
            primaryDomain: 'b-shop.myshopify.com',
            createdAt: '2026-05-01T00:00:00Z',
          }),
          accessibleShopNode({
            shopifyShopId: '1',
            name: 'A Shop',
            storeType: 'DEVELOPMENT',
            primaryDomain: 'a-shop.myshopify.com',
            createdAt: '2026-05-01T00:00:00Z',
          }),
        ],
      }),
    )

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

    const requestOptions = latestBusinessPlatformRequestOptions()
    await requestOptions.unauthorizedHandler.handler()

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {noPrompt: undefined})
  })
})

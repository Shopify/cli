import {deleteDevStore, toOrganizationsShopifyShopId} from './dev.js'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/business-platform', () => ({
  businessPlatformOrganizationsRequestDoc: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/session', () => ({
  ensureAuthenticatedBusinessPlatform: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/ui', () => ({
  renderSingleTask: vi.fn(),
  renderSuccess: vi.fn(),
  renderWarning: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

vi.mock('@shopify/cli-kit/node/system', () => ({
  sleep: vi.fn(),
}))

const defaultOrg = {id: '123', businessName: 'Test Org'}
const defaultOptions = {store: 'test-store.myshopify.com', organization: defaultOrg, json: false}
const defaultMutationResult = {
  deleteAppDevelopmentStore: {
    success: true,
    userErrors: [],
  },
}
const defaultShopLookupResult = {
  organization: {
    accessibleShops: {
      edges: [
        {
          node: {
            shopifyShopId: '72193245184',
            name: 'Test Store',
            primaryDomain: 'https://test-store.myshopify.com',
            storeType: 'APP_DEVELOPMENT',
            developerPreviewHandle: null,
            planName: 'professional',
            ownerDetails: null,
          },
        },
      ],
    },
  },
}

const encodedDefaultShopId = 'Z2lkOi8vb3JnYW5pemF0aW9uL1Nob3BpZnlTaG9wLzcyMTkzMjQ1MTg0'

type PollShop = {shopifyShopId?: string | null; planName?: string | null; storeType?: string | null} | null

beforeEach(() => {
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
  vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  vi.mocked(sleep).mockResolvedValue(undefined)
  mockBusinessPlatformRequests()
})

describe('toOrganizationsShopifyShopId', () => {
  test('converts a raw numeric Core shop ID to an Organizations ShopifyShopID', () => {
    expect(toOrganizationsShopifyShopId('18')).toBe('Z2lkOi8vb3JnYW5pemF0aW9uL1Nob3BpZnlTaG9wLzE4')
    expect(toOrganizationsShopifyShopId(18)).toBe('Z2lkOi8vb3JnYW5pemF0aW9uL1Nob3BpZnlTaG9wLzE4')
  })

  test('converts a Core Admin shop GID to an Organizations ShopifyShopID', () => {
    expect(toOrganizationsShopifyShopId('gid://shopify/Shop/18')).toBe('Z2lkOi8vb3JnYW5pemF0aW9uL1Nob3BpZnlTaG9wLzE4')
  })
})

describe('deleteDevStore', () => {
  test('requests deletion and renders success after polling sees the plan become cancelled', async () => {
    mockBusinessPlatformRequests({pollShops: [pollShop({planName: 'professional'}), pollShop({planName: 'cancelled'})]})

    await deleteDevStore(defaultOptions)

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        token: 'test-token',
        organizationId: '123',
        variables: {storeFqdn: 'test-store.myshopify.com'},
        unauthorizedHandler: expect.objectContaining({type: 'token_refresh'}),
      }),
    )
    expect(mutationRequests()).toHaveLength(1)
    expect(pollRequests()).toHaveLength(2)
    expect(pollRequests()[0]?.variables).toEqual({id: encodedDefaultShopId})
    expect(sleep).toHaveBeenCalledWith(5)
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('deleted successfully'),
        body: ['The store was deleted.'],
      }),
    )
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('outputs JSON when --json flag is set', async () => {
    await deleteDevStore({...defaultOptions, json: true})

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    expect(JSON.parse(call)).toEqual({
      store: {
        domain: 'test-store.myshopify.com',
        deletionRequested: true,
        deletionConfirmed: true,
      },
      organization: {
        id: '123',
        name: 'Test Org',
      },
    })
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('throws AbortError when mutation returns null deleteAppDevelopmentStore', async () => {
    mockBusinessPlatformRequests({mutationResult: {deleteAppDevelopmentStore: null}})

    await expect(deleteDevStore(defaultOptions)).rejects.toThrow('Store deletion failed: unexpected empty response.')
  })

  test('throws AbortError and does not poll when mutation returns userErrors', async () => {
    mockBusinessPlatformRequests({
      mutationResult: {
        deleteAppDevelopmentStore: {
          success: false,
          userErrors: [{code: 'NOT_FOUND', field: ['storeFqdn'], message: 'Store not found'}],
        },
      },
    })

    await expect(deleteDevStore(defaultOptions)).rejects.toThrow('Failed to delete development store: Store not found')

    expect(renderSingleTask).not.toHaveBeenCalled()
    expect(mutationRequests()).toHaveLength(1)
    expect(pollRequests()).toHaveLength(0)
  })

  test('passes the backend CLI gate error message through verbatim', async () => {
    mockBusinessPlatformRequests({
      mutationResult: {
        deleteAppDevelopmentStore: {
          success: false,
          userErrors: [
            {
              code: 'cli_store_management_not_enabled',
              field: ['base'],
              message: 'Store management from the Shopify CLI is not yet enabled for your organization.',
            },
          ],
        },
      },
    })

    await expect(deleteDevStore(defaultOptions)).rejects.toThrow(
      'Failed to delete development store: Store management from the Shopify CLI is not yet enabled for your organization.',
    )

    expect(renderSingleTask).not.toHaveBeenCalled()
    expect(mutationRequests()).toHaveLength(1)
    expect(pollRequests()).toHaveLength(0)
  })

  test('throws AbortError when mutation reports failure without userErrors', async () => {
    mockBusinessPlatformRequests({
      mutationResult: {
        deleteAppDevelopmentStore: {
          success: false,
          userErrors: [],
        },
      },
    })

    await expect(deleteDevStore(defaultOptions)).rejects.toThrow('Store deletion failed.')
  })

  test('passes the selected organization ID to the GraphQL request', async () => {
    await deleteDevStore({...defaultOptions, organization: {id: '456', businessName: 'Another Org'}})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '456',
      }),
    )
  })

  test('reports requested but not confirmed when polling times out before the plan becomes cancelled', async () => {
    let dateNowCallCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      dateNowCallCount++
      if (dateNowCallCount <= 2) return 0
      return 6 * 60 * 1000
    })
    mockBusinessPlatformRequests({pollShops: [pollShop({planName: 'professional'})]})

    await expect(deleteDevStore(defaultOptions)).resolves.toBeUndefined()

    expect(mutationRequests()).toHaveLength(1)
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('deletion was requested, but not confirmed'),
        body: expect.arrayContaining([expect.stringContaining('still finish deleting asynchronously')]),
      }),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('continues polling until planName matches cancelled after normalization', async () => {
    mockBusinessPlatformRequests({
      pollShops: [pollShop({planName: 'deleted'}), pollShop({planName: 'Cancelled'})],
    })

    await deleteDevStore(defaultOptions)

    expect(pollRequests()).toHaveLength(2)
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('deleted successfully')}),
    )
  })

  test('does not treat a null accessibleShop response as confirmed deletion', async () => {
    mockBusinessPlatformRequests({pollShops: [null, pollShop({planName: 'cancelled'})]})

    await deleteDevStore(defaultOptions)

    expect(pollRequests()).toHaveLength(2)
    expect(sleep).toHaveBeenCalledWith(5)
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({headline: expect.stringContaining('deleted successfully')}),
    )
    expect(renderWarning).not.toHaveBeenCalled()
  })
})

function mockBusinessPlatformRequests(options: {mutationResult?: unknown; pollShops?: PollShop[]} = {}) {
  const mutationResult = options.mutationResult ?? defaultMutationResult
  const pollShops = options.pollShops ?? [pollShop({planName: 'cancelled'})]
  let pollIndex = 0

  vi.mocked(businessPlatformOrganizationsRequestDoc).mockImplementation(async (request) => {
    const variables = request.variables as Record<string, unknown>

    if ('search' in variables) {
      return defaultShopLookupResult as never
    }

    if ('storeFqdn' in variables) {
      return mutationResult as never
    }

    if ('id' in variables) {
      const shop = pollShops[Math.min(pollIndex, pollShops.length - 1)]
      pollIndex++
      return {organization: {accessibleShop: shop}} as never
    }

    throw new Error(`Unexpected request variables: ${JSON.stringify(variables)}`)
  })
}

function pollShop(overrides: NonNullable<PollShop> = {}): NonNullable<PollShop> {
  return {
    shopifyShopId: '72193245184',
    planName: 'cancelled',
    storeType: 'APP_DEVELOPMENT',
    ...overrides,
  }
}

function mutationRequests() {
  return requestsWithVariable('storeFqdn')
}

function pollRequests() {
  return requestsWithVariable('id')
}

function requestsWithVariable(variableName: string) {
  return vi
    .mocked(businessPlatformOrganizationsRequestDoc)
    .mock.calls.map(([request]) => request)
    .filter((request) => variableName in (request.variables as Record<string, unknown>))
}

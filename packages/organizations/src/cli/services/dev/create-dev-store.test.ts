import {createDevStore} from './create-dev-store.js'
import {recordStoreFqdnMetadata} from '../store-attribution.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/api/business-platform', () => ({
  businessPlatformOrganizationsRequestDoc: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/session', () => ({
  ensureAuthenticatedBusinessPlatform: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/ui', () => ({
  renderSingleTask: vi.fn(),
  renderSuccess: vi.fn(),
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

vi.mock('../store-attribution.js')

const defaultOrg = {id: '123', businessName: 'Test Org'}

// The default shop id is a global id because that's what Business Platform returns. Tests that
// assert on the recorded id pass their own, so the value under test sits next to its expectation.
function mutationResult(shopifyShopId: string | null = 'gid://shopify/Shop/456') {
  return {
    createAppDevelopmentStore: {
      shopAdminUrl: 'https://test-store.myshopify.com/admin',
      shopDomain: 'test-store.myshopify.com',
      shopifyShopId,
      userErrors: [],
    },
  }
}

beforeEach(() => {
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
  vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
    return task(() => {})
  })
  vi.mocked(sleep).mockResolvedValue(undefined)
})

describe('createDevStore', () => {
  test('returns the polled shop domain without rendering output when summary is false', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(mutationResult())
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    const domain = await createDevStore({
      name: 'test-store',
      organization: defaultOrg,
      plan: 'plus',
      json: false,
      summary: false,
    })

    expect(domain).toBe('test-store.myshopify.com')
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: {shopDomain: 'test-store.myshopify.com'},
      }),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('records the created store with the numeric id decoded from the returned global id', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(mutationResult('gid://shopify/Shop/456'))
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'COMPLETE'}}})

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false})

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      validated: true,
      storeId: '456',
    })
  })

  test('records a shop id that is already numeric unchanged', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(mutationResult('456'))
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'COMPLETE'}}})

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false})

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      validated: true,
      storeId: '456',
    })
  })

  test('records the store domain without an id when no shop id is returned', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(mutationResult(null))
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'COMPLETE'}}})

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false})

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      validated: true,
      storeId: undefined,
    })
  })

  // The store exists server-side even when polling never reports COMPLETE, so attribution has to be
  // recorded before the wait rather than after it.
  test('records the created store even when polling reports a failure', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(mutationResult('456'))
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'FAILED'}}})

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false}),
    ).rejects.toThrow('Store creation failed with status: FAILED')

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      validated: true,
      storeId: '456',
    })
  })
})

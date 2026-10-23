import {createDevStoreJsonOutputSchema} from './types.js'
import {createDevStore} from './create-dev-store.js'
import {PollStoreCreation} from '../../api/graphql/business-platform-organizations/generated/poll_store_creation.js'
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

const defaultOrg = {id: '123', businessName: 'Test Org'}
const defaultMutationResult = {
  createAppDevelopmentStore: {
    shopAdminUrl: 'https://test-store.myshopify.com/admin',
    shopDomain: 'test-store.myshopify.com',
    userErrors: [],
  },
}

beforeEach(() => {
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
  vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
    return task(() => {})
  })
  vi.mocked(sleep).mockResolvedValue(undefined)
})

describe('createDevStore', () => {
  test.each([undefined, null])('waits for an initially missing creation record (%s)', async (storeCreation) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization: {id: '123', storeCreation}})
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'AWAITING_CORE_STORE_READY'}}})
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'COMPLETE'}}})
    vi.mocked(sleep).mockImplementation(async () => {
      expect(outputResult).not.toHaveBeenCalled()
    })

    const domain = await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'basic', json: true})

    expect(domain).toBe('test-store.myshopify.com')
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(4)
    for (const [request] of vi.mocked(businessPlatformOrganizationsRequestDoc).mock.calls.slice(1)) {
      expect(request).toMatchObject({query: PollStoreCreation, variables: {shopDomain: domain}})
    }
    expect(JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string).store.domain).toBe(domain)
  })

  test('stops waiting for a missing creation record at the existing timeout', async () => {
    let now = 0
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValue({organization: {id: '123', storeCreation: null}})
    vi.mocked(sleep).mockImplementation(async (seconds) => {
      now += seconds * 1000
    })

    try {
      await expect(
        createDevStore({name: 'test-store', organization: defaultOrg, plan: 'basic', json: true}),
      ).rejects.toThrow('Store creation timed out after 5 minutes.')
      expect(now).toBeGreaterThanOrEqual(5 * 60_000)
      expect(now).toBeLessThanOrEqual(5 * 60_000 + 2000)
      expect(outputResult).not.toHaveBeenCalled()
    } finally {
      clock.mockRestore()
    }
  })

  test.each([undefined, null])('does not retry a missing organization (%s)', async (organization) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization})

    await expect(createDevStore({name: 'test-store', organization: defaultOrg, plan: 'basic'})).rejects.toThrow(
      'Unable to determine store creation status.',
    )
    expect(sleep).not.toHaveBeenCalled()
  })

  test.each(['FAILED', 'TIMED_OUT', 'USER_ERROR'])('does not retry terminal creation status %s', async (status) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status}}})

    await expect(createDevStore({name: 'test-store', organization: defaultOrg, plan: 'basic'})).rejects.toThrow(
      `Store creation failed with status: ${status}`,
    )
    expect(sleep).not.toHaveBeenCalled()
  })

  test('preserves unrelated polling errors', async () => {
    const error = new Error('Authentication failed')
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockRejectedValueOnce(error)

    await expect(createDevStore({name: 'test-store', organization: defaultOrg, plan: 'basic'})).rejects.toBe(error)
    expect(sleep).not.toHaveBeenCalled()
  })

  test('returns the polled shop domain without rendering output when summary is false', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
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
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledWith([], {allowAutomationToken: true})
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: {shopDomain: 'test-store.myshopify.com'},
      }),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })
})

test.each([undefined, null, 'https://admin.shopify.com/store/test-store'])(
  'validates JSON output with admin URL %s and preserves optional creation fields',
  async (adminUrl) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce({
        createAppDevelopmentStore: {...defaultMutationResult.createAppDevelopmentStore, shopAdminUrl: adminUrl},
      })
      .mockResolvedValueOnce({organization: {storeCreation: {status: 'COMPLETE'}}})

    await createDevStore({
      name: 'test-store',
      organization: defaultOrg,
      plan: 'plus',
      featurePreview: 'extended_variants',
      country: 'CA',
      withDemoData: true,
      json: true,
    })

    const result = JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)
    expect(result).toEqual({
      store: {
        name: 'test-store',
        domain: 'test-store.myshopify.com',
        ...(adminUrl === undefined ? {} : {adminUrl}),
        plan: 'plus',
        featurePreview: 'extended_variants',
        country: 'CA',
        demoData: true,
      },
      organization: {id: '123', name: 'Test Org'},
    })
    expect(createDevStoreJsonOutputSchema.validate(result)).toEqual(result)
    expect(renderSuccess).not.toHaveBeenCalled()
  },
)

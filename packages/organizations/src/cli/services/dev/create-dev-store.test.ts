import {createDevStoreJsonOutputSchema} from './types.js'
import {createDevStore} from './create-dev-store.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform, isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/business-platform', () => ({
  businessPlatformOrganizationsRequestDoc: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/session', () => ({
  ensureAuthenticatedBusinessPlatform: vi.fn(),
  isServiceAccountTokenSet: vi.fn(),
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

  test('keeps polling while the store creation status is missing from a lagging read', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: null}})
      .mockResolvedValueOnce({organization: null})
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'AWAITING_CORE_STORE_READY'}}})
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'COMPLETE'}}})

    const domain = await createDevStore({
      name: 'test-store',
      organization: defaultOrg,
      plan: 'plus',
      json: false,
      summary: false,
    })

    expect(domain).toBe('test-store.myshopify.com')
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  test('still fails on a terminal status reported after a missing read', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: null}})
      .mockResolvedValueOnce({organization: {id: '123', storeCreation: {status: 'FAILED'}}})

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false, summary: false}),
    ).rejects.toThrow('Store creation failed with status: FAILED')
  })

  test('times out with next steps when no store creation status is ever reported', async () => {
    let clock = 0
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock)
    vi.mocked(sleep).mockImplementation(async (seconds) => {
      clock += seconds * 1000
    })
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValue({organization: {id: '123', storeCreation: null}})

    try {
      const error = await createDevStore({
        name: 'test-store',
        organization: defaultOrg,
        plan: 'plus',
        json: false,
        summary: false,
      }).catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(AbortError)
      expect((error as AbortError).message).toBe('Store creation timed out after 5 minutes without reporting a status.')
      expect((error as AbortError).nextSteps).toEqual([
        'Check whether test-store.myshopify.com was created with `shopify store list` before trying again.',
      ])
      // The mutation, then one poll every 2 seconds for the full 5 minutes.
      expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(1 + 151)
    } finally {
      now.mockRestore()
    }
  })

  test('explains the missing dev store access when the Organizations API refuses a service account', async () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValueOnce(
      Object.assign(new Error('The Business Platform GraphQL API responded unsuccessfully with the HTTP status 401.'), {
        statusCode: 401,
      }),
    )

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false, summary: false}),
    ).rejects.toThrow("This service account can't manage dev stores in Test Org.")
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

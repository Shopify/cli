import {createDevStoreJsonOutputSchema} from './types.js'
import {createDevStore} from './create-dev-store.js'
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

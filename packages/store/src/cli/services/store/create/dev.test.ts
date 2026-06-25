import {createDevStore} from './dev.js'
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
  vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(defaultMutationResult)
  vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
    return task(() => {})
  })
  vi.mocked(sleep).mockResolvedValue(undefined)
})

describe('createDevStore', () => {
  test('creates a development store and renders success', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false})

    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        token: 'test-token',
        organizationId: '123',
        variables: {
          shopName: 'test-store',
          priceLookupKey: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
          prepopulateTestData: false,
          developerPreviewHandle: undefined,
        },
      }),
    )
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('test-store'),
      }),
    )
  })

  test.each([
    ['basic', 'BASIC_APP_DEVELOPMENT'],
    ['grow', 'PROFESSIONAL_APP_DEVELOPMENT'],
    ['advanced', 'UNLIMITED_APP_DEVELOPMENT'],
    ['plus', 'SHOPIFY_PLUS_APP_DEVELOPMENT'],
  ] as const)('maps the %s plan to the %s price lookup key', async (plan, priceLookupKey) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan, json: false})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({priceLookupKey}),
      }),
    )
  })

  test('passes the feature preview as developerPreviewHandle', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({
      name: 'test-store',
      organization: defaultOrg,
      plan: 'plus',
      featurePreview: 'extended_variants',
      json: false,
    })

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({developerPreviewHandle: 'extended_variants'}),
      }),
    )
  })

  test('passes prepopulateTestData when --with-demo-data is set', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', withDemoData: true, json: false})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({prepopulateTestData: true}),
      }),
    )
  })

  test('includes plan, feature preview, and demo data in JSON output', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({
      name: 'test-store',
      organization: defaultOrg,
      plan: 'basic',
      featurePreview: 'extended_variants',
      withDemoData: true,
      json: true,
    })

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"plan": "basic"'))
    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"featurePreview": "extended_variants"'))
    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"demoData": true'))
  })

  test('outputs JSON when --json flag is set', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: true})

    expect(outputResult).toHaveBeenCalledWith(expect.stringContaining('"domain": "test-store.myshopify.com"'))
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('throws AbortError when mutation returns null createAppDevelopmentStore', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      createAppDevelopmentStore: null,
    })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('unexpected empty response')
  })

  test('throws AbortError when mutation returns userErrors', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      createAppDevelopmentStore: {
        shopAdminUrl: null,
        shopDomain: null,
        userErrors: [{code: 'INVALID', field: ['shopName'], message: 'Name is taken'}],
      },
    })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('Name is taken')
  })

  test('throws AbortError when mutation returns no shopDomain', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      createAppDevelopmentStore: {
        shopAdminUrl: null,
        shopDomain: null,
        userErrors: [],
      },
    })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('no shop domain was returned')
  })

  test('throws AbortError when polling returns FAILED status', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'FAILED'}},
      })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('Store creation failed with status: FAILED')
  })

  test('throws AbortError when polling returns TIMED_OUT status', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'TIMED_OUT'}},
      })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('Store creation failed with status: TIMED_OUT')
  })

  test('throws AbortError when polling returns USER_ERROR status', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'USER_ERROR'}},
      })

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('Store creation failed with status: USER_ERROR')
  })

  test('throws AbortError when polling times out after 5 minutes', async () => {
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      // First call returns start time, second call exceeds timeout
      if (callCount <= 1) return 0
      return 6 * 60 * 1000
    })

    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce(defaultMutationResult)

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false}),
    ).rejects.toThrow('Store creation timed out after 5 minutes')
  })

  test('calls sleep with 2 seconds between polls', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'CALLING_CORE'}},
      })
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false})

    expect(sleep).toHaveBeenCalledWith(2)
  })

  test('renders progress to stderr via renderOptions', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({
        organization: {id: '123', storeCreation: {status: 'COMPLETE'}},
      })

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: false})

    expect(renderSingleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        renderOptions: {stdout: process.stderr},
      }),
    )
  })
})

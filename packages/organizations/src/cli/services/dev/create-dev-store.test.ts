import {createDevStoreJsonOutputSchema} from './types.js'
import {createDevStore} from './create-dev-store.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {addPublicMetadata, getAllPublicMetadata, getAllSensitiveMetadata} from '@shopify/cli-kit/node/metadata'

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
    shopifyShopId: '123456789',
    userErrors: [],
  },
}

beforeEach(async () => {
  await addPublicMetadata(() => ({store_id: undefined}))
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
    expect(getAllPublicMetadata().store_id).toBe(123456789)
    expect(getAllPublicMetadata()).not.toHaveProperty('store_creation')
    expect(getAllSensitiveMetadata()).not.toHaveProperty('store_creation')
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: {shopDomain: 'test-store.myshopify.com'},
      }),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test.each([
    ['123456789', 123456789],
    ['000123456789', 123456789],
    ['gid://shopify/Shop/123456789', 123456789],
    ['gid://shopify/Shop/000123456789', 123456789],
    ['1', 1],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
    ['gid://shopify/Shop/9007199254740991', Number.MAX_SAFE_INTEGER],
    [123456789, 123456789],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])('records the native shop ID %s before polling', async (shopifyShopId, expectedId) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce({
        createAppDevelopmentStore: {...defaultMutationResult.createAppDevelopmentStore, shopifyShopId},
      })
      .mockImplementationOnce(async () => {
        expect(getAllPublicMetadata().store_id).toBe(expectedId)
        return {organization: {storeCreation: {status: 'COMPLETE'}}}
      })

    const domain = await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false})

    expect(domain).toBe('test-store.myshopify.com')
    expect(getAllPublicMetadata().store_id).toBe(expectedId)
    expect(getAllPublicMetadata()).not.toHaveProperty('store_creation')
    expect(getAllSensitiveMetadata()).not.toHaveProperty('store_creation')
    expect(getAllPublicMetadata()).not.toHaveProperty('store_domain')
    expect(getAllPublicMetadata()).not.toHaveProperty('store_fqdn_hash')
    expect(getAllSensitiveMetadata()).not.toHaveProperty('store_fqdn')
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
  })

  test.each([
    undefined,
    null,
    '',
    '0',
    0,
    -1,
    '-1',
    '+123',
    '123abc',
    ' 123',
    '123 ',
    '123\n',
    '1.5',
    1.5,
    '1e3',
    '0x123',
    'NaN',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '9007199254740992',
    Number.MAX_SAFE_INTEGER + 1,
    'gid://shopify/Shop/0',
    'gid://shopify/Shop/9007199254740992',
    'gid://shopify/Product/123',
    'gid://organization/Shop/123',
    'gid://organization/Organization/123',
    'gid://shopify/Shop/extra/123',
    'gid://shopify/Shop/123?x=1',
    'gid://shopify/Shop/123\n',
    'Z2lkOi8vc2hvcGlmeS9TaG9wLzEyMw==',
    true,
    {},
    ['123'],
  ])('omits an absent or invalid shop ID %j without changing creation', async (shopifyShopId) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce({
        createAppDevelopmentStore: {...defaultMutationResult.createAppDevelopmentStore, shopifyShopId},
      })
      .mockResolvedValueOnce({organization: {storeCreation: {status: 'COMPLETE'}}})

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false}),
    ).resolves.toBe('test-store.myshopify.com')
    expect(getAllPublicMetadata().store_id).toBeUndefined()
    expect(getAllPublicMetadata()).not.toHaveProperty('store_creation')
    expect(getAllSensitiveMetadata()).not.toHaveProperty('store_creation')
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
  })

  test.each([
    [null, 'Store creation failed: unexpected empty response.'],
    [
      {
        ...defaultMutationResult.createAppDevelopmentStore,
        userErrors: [{code: 'INVALID', field: ['shopName'], message: 'Name is taken'}],
      },
      'Failed to create dev store: Name is taken',
    ],
    [
      {...defaultMutationResult.createAppDevelopmentStore, shopDomain: null},
      'Store creation succeeded but no shop domain was returned.',
    ],
  ])('does not record identity for an early creation error %j', async (response, message) => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({createAppDevelopmentStore: response})

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: true}),
    ).rejects.toThrow(message)
    expect(getAllPublicMetadata().store_id).toBeUndefined()
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(1)
    expect(renderSingleTask).not.toHaveBeenCalled()
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(outputResult).not.toHaveBeenCalled()
  })

  test.each(['FAILED', 'TIMED_OUT', 'USER_ERROR', undefined])(
    'retains the creation identity when polling returns %s',
    async (status) => {
      vi.mocked(businessPlatformOrganizationsRequestDoc)
        .mockResolvedValueOnce(defaultMutationResult)
        .mockImplementationOnce(async () => {
          expect(getAllPublicMetadata().store_id).toBe(123456789)
          return {organization: {storeCreation: {status}}}
        })

      await expect(
        createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: true}),
      ).rejects.toThrow(
        status ? `Store creation failed with status: ${status}` : 'Unable to determine store creation status.',
      )
      expect(getAllPublicMetadata().store_id).toBe(123456789)
      expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
      expect(renderSuccess).not.toHaveBeenCalled()
      expect(outputResult).not.toHaveBeenCalled()
    },
  )

  test('retains the creation identity when polling throws', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockRejectedValueOnce(new Error('Polling request failed'))

    await expect(
      createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: true}),
    ).rejects.toThrow('Polling request failed')
    expect(getAllPublicMetadata().store_id).toBe(123456789)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(outputResult).not.toHaveBeenCalled()
  })

  test('retains the creation identity when the readiness wait exceeds five minutes', async () => {
    const dateNow = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(6 * 60 * 1000)
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce(defaultMutationResult)

    try {
      await expect(
        createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', json: true}),
      ).rejects.toThrow('Store creation timed out after 5 minutes.')
      expect(getAllPublicMetadata().store_id).toBe(123456789)
      expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(1)
      expect(outputResult).not.toHaveBeenCalled()
    } finally {
      dateNow.mockRestore()
    }
  })

  test('preserves readiness polling and progress updates', async () => {
    const updateStatus = vi.fn()
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      expect(getAllPublicMetadata().store_id).toBe(123456789)
      return task(updateStatus)
    })
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce(defaultMutationResult)
      .mockResolvedValueOnce({organization: {storeCreation: {status: 'CALLING_CORE'}}})
      .mockResolvedValueOnce({organization: {storeCreation: {status: 'COMPLETE'}}})

    await createDevStore({name: 'test-store', organization: defaultOrg, plan: 'plus', summary: false})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledExactlyOnceWith(2)
    expect(updateStatus).toHaveBeenCalledOnce()
    expect(updateStatus.mock.calls[0]![0].value).toBe('Initiating store creation')
    expect(renderSingleTask).toHaveBeenCalledWith(expect.objectContaining({renderOptions: {stdout: process.stderr}}))
  })

  test.each([null, 'https://test-store.myshopify.com/admin'])(
    'preserves the human summary with admin URL %s',
    async (shopAdminUrl) => {
      vi.mocked(businessPlatformOrganizationsRequestDoc)
        .mockResolvedValueOnce({
          createAppDevelopmentStore: {...defaultMutationResult.createAppDevelopmentStore, shopAdminUrl},
        })
        .mockResolvedValueOnce({organization: {storeCreation: {status: 'COMPLETE'}}})

      await createDevStore({
        name: 'test-store',
        organization: defaultOrg,
        plan: 'plus',
        featurePreview: 'extended_variants',
        country: 'CA',
        withDemoData: true,
      })

      expect(renderSuccess).toHaveBeenCalledExactlyOnceWith({
        headline: 'Dev store "test-store" created successfully.',
        customSections: [
          {
            body: {
              tabularData: [
                ['Domain', 'test-store.myshopify.com'],
                ['Admin', shopAdminUrl ? {link: {label: shopAdminUrl, url: shopAdminUrl}} : 'N/A'],
                ['Plan', 'plus'],
                ['Feature preview', 'extended_variants'],
                ['Country', 'CA'],
                ['Demo data', 'enabled'],
              ],
              firstColumnSubdued: true,
            },
          },
        ],
      })
      expect(getAllPublicMetadata().store_id).toBe(123456789)
      expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
      expect(outputResult).not.toHaveBeenCalled()
    },
  )
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
    expect(outputResult).toHaveBeenCalledExactlyOnceWith(JSON.stringify(result, null, 2))
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(getAllPublicMetadata().store_id).toBe(123456789)
    expect(renderSuccess).not.toHaveBeenCalled()
  },
)

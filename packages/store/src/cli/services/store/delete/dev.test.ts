import {deleteDevStore} from './dev.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('@shopify/organizations', () => ({
  selectOrg: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/api/business-platform', () => ({
  businessPlatformOrganizationsRequestDoc: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/session', () => ({
  ensureAuthenticatedBusinessPlatform: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/ui', () => ({
  renderSuccess: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

import {selectOrg} from '@shopify/organizations'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'

const defaultOrg = {id: '123', businessName: 'Test Org'}
const defaultMutationResult = {
  deleteAppDevelopmentStore: {
    success: true,
    userErrors: [],
  },
}

beforeEach(() => {
  vi.mocked(selectOrg).mockResolvedValue(defaultOrg)
  vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
  vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue(defaultMutationResult)
})

describe('deleteDevStore', () => {
  test('deletes a development store and renders success', async () => {
    await deleteDevStore({store: 'test-store.myshopify.com', json: false})

    expect(selectOrg).toHaveBeenCalledWith(undefined)
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalled()
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.anything(),
        token: 'test-token',
        organizationId: '123',
        variables: {storeFqdn: 'test-store.myshopify.com'},
      }),
    )
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('test-store.myshopify.com'),
      }),
    )
  })

  test('outputs JSON when --json flag is set', async () => {
    await deleteDevStore({store: 'test-store.myshopify.com', json: true})

    expect(outputResult).toHaveBeenCalledWith(
      expect.stringContaining('"status": "deleted"'),
    )
    expect(outputResult).toHaveBeenCalledWith(
      expect.stringContaining('"store": "test-store.myshopify.com"'),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('JSON output includes organization id and name', async () => {
    await deleteDevStore({store: 'test-store.myshopify.com', json: true})

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    const parsed = JSON.parse(call)
    expect(parsed).toEqual({
      status: 'deleted',
      store: 'test-store.myshopify.com',
      organization: {
        id: '123',
        name: 'Test Org',
      },
    })
  })

  test('throws AbortError when mutation returns null deleteAppDevelopmentStore', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      deleteAppDevelopmentStore: null,
    })

    await expect(deleteDevStore({store: 'test-store.myshopify.com', json: false})).rejects.toThrow(
      'Store deletion failed: unexpected response',
    )
  })

  test('throws AbortError when mutation returns userErrors', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValueOnce({
      deleteAppDevelopmentStore: {
        success: false,
        userErrors: [{code: 'NOT_FOUND', field: ['storeFqdn'], message: 'Store not found'}],
      },
    })

    await expect(deleteDevStore({store: 'test-store.myshopify.com', json: false})).rejects.toThrow(
      'Store not found',
    )
  })

  test('passes organization flag to selectOrg', async () => {
    await deleteDevStore({store: 'test-store.myshopify.com', organization: '456', json: false})

    expect(selectOrg).toHaveBeenCalledWith('456')
  })

  test('maps --store flag to storeFqdn GraphQL variable', async () => {
    await deleteDevStore({store: 'custom-store.myshopify.com', json: false})

    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {storeFqdn: 'custom-store.myshopify.com'},
      }),
    )
  })
})

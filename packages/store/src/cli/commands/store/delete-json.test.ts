import StoreDelete from './delete.js'
import {resolveOrganizationForStore} from '../../utilities/store-lookup/organization.js'
import {fetchOptionalOrganizationShop} from '../../utilities/store-lookup/organization-shop.js'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'

vi.mock('../../utilities/store-lookup/organization.js')
vi.mock('../../utilities/store-lookup/organization-shop.js')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  ensureAuthenticatedBusinessPlatform: vi.fn(),
}))

describeJsonCommand({
  command: StoreDelete,
  commandId: 'store:delete',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', 'my-store.myshopify.com', '--organization-id', '12345', '--force'],
  expectedResult: {
    store: {domain: 'my-store.myshopify.com', deletionRequested: true, deletionConfirmed: true},
    organization: {id: '12345', name: 'Test Org'},
  },
  expectedEvents: [
    {type: 'progress', status: 'started', message: 'Dev store deletion requested. Waiting for deletion confirmation'},
    {type: 'progress', status: 'completed', message: 'Dev store deletion requested. Waiting for deletion confirmation'},
  ],
  expectedSchema: {
    anyOf: [{required: ['store', 'organization']}, {required: ['error', 'message', 'nextSteps', 'exitCode']}],
  },
  setup: () => {
    vi.mocked(resolveOrganizationForStore).mockResolvedValue({id: '12345', businessName: 'Test Org'})
    vi.mocked(fetchOptionalOrganizationShop).mockResolvedValue({shopifyShopId: '18', name: 'My Store'})
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce({deleteAppDevelopmentStore: {success: true, userErrors: []}})
      .mockResolvedValueOnce({organization: {accessibleShop: {planName: 'cancelled'}}})
  },
  assertExecuted: () => {
    expect(resolveOrganizationForStore).toHaveBeenCalledExactlyOnceWith('my-store.myshopify.com', '12345')
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledExactlyOnceWith([], {allowAutomationToken: true})
    expect(fetchOptionalOrganizationShop).toHaveBeenCalledExactlyOnceWith({
      store: 'my-store.myshopify.com',
      organizationId: '12345',
      token: 'test-token',
    })
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({organizationId: '12345', variables: {storeFqdn: 'my-store.myshopify.com'}}),
    )
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({variables: {id: 'Z2lkOi8vb3JnYW5pemF0aW9uL1Nob3BpZnlTaG9wLzE4'}}),
    )
  },
  assertNotExecuted: () => {
    expect(resolveOrganizationForStore).not.toHaveBeenCalled()
    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    expect(fetchOptionalOrganizationShop).not.toHaveBeenCalled()
    expect(businessPlatformOrganizationsRequestDoc).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Dev store "my-store.myshopify.com" deleted successfully.')
    expect(stderr).toContain('The store was deleted.')
  },
})

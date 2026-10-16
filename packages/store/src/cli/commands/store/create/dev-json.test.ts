import StoreCreateDev from './dev.js'
import {selectOrg} from '@shopify/organizations'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {expect, vi} from 'vitest'

vi.mock('@shopify/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/organizations')>()),
  selectOrg: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/session')>()),
  ensureAuthenticatedBusinessPlatform: vi.fn(),
}))

const organization = {id: '12345', businessName: 'Test Org'}

describeJsonCommand({
  command: StoreCreateDev,
  commandId: 'store:create:dev',
  moduleURL: new URL('../../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--name', 'my-test-store', '--plan', 'plus', '--organization-id', '12345', '--no-demo-data'],
  expectedResult: {
    store: {
      name: 'my-test-store',
      domain: 'my-test-store.myshopify.com',
      adminUrl: 'https://my-test-store.myshopify.com/admin',
      plan: 'plus',
      demoData: false,
    },
    organization: {id: '12345', name: 'Test Org'},
  },
  expectedEvents: [
    {type: 'progress', status: 'started', message: 'Waiting for store to be ready'},
    {type: 'progress', status: 'completed', message: 'Waiting for store to be ready'},
  ],
  expectedSchema: {
    anyOf: [{required: ['store', 'organization']}, {required: ['error', 'message', 'nextSteps', 'exitCode']}],
  },
  setup: () => {
    vi.mocked(selectOrg).mockResolvedValue(organization)
    vi.mocked(ensureAuthenticatedBusinessPlatform).mockResolvedValue('test-token')
    vi.mocked(businessPlatformOrganizationsRequestDoc)
      .mockResolvedValueOnce({
        createAppDevelopmentStore: {
          shopDomain: 'my-test-store.myshopify.com',
          shopAdminUrl: 'https://my-test-store.myshopify.com/admin',
          userErrors: [],
        },
      })
      .mockResolvedValueOnce({organization: {storeCreation: {status: 'COMPLETE'}}})
  },
  assertExecuted: () => {
    expect(selectOrg).toHaveBeenCalledExactlyOnceWith('12345')
    expect(ensureAuthenticatedBusinessPlatform).toHaveBeenCalledExactlyOnceWith([], {allowAutomationToken: true})
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledTimes(2)
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        organizationId: '12345',
        variables: expect.objectContaining({shopName: 'my-test-store', prepopulateTestData: false}),
      }),
    )
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({variables: {shopDomain: 'my-test-store.myshopify.com'}}),
    )
  },
  assertNotExecuted: () => {
    expect(selectOrg).not.toHaveBeenCalled()
    expect(ensureAuthenticatedBusinessPlatform).not.toHaveBeenCalled()
    expect(businessPlatformOrganizationsRequestDoc).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('Dev store "my-test-store" created successfully.')
    expect(stderr).toContain('my-test-store.myshopify.com')
    expect(stderr).toContain('disabled')
  },
})

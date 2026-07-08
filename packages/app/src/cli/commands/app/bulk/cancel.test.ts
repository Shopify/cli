import BulkCancel from './cancel.js'
import {cancelBulkOperation} from '../../../services/bulk-operations/cancel-bulk-operation.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../../services/bulk-operations/cancel-bulk-operation.js')
vi.mock('../../../utilities/execute-command-helpers.js')

describe('app bulk cancel command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const store = testOrganizationStore({shopDomain: 'shop.myshopify.com'})

  beforeEach(() => {
    vi.mocked(prepareAppStoreContext).mockResolvedValue({
      appContextResult: {
        app,
        remoteApp,
        developerPlatformClient: remoteApp.developerPlatformClient,
        organization: testOrganization(),
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      },
      store,
    })
    vi.mocked(cancelBulkOperation).mockResolvedValue()
  })

  test('prepares app/store context and cancels bulk operation', async () => {
    // When
    await BulkCancel.run(['--path', '/tmp/app', '--id', '12345', '--store', 'shop'])

    // Then
    expect(prepareAppStoreContext).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/tmp/app',
        id: '12345',
        store: 'shop.myshopify.com',
      }),
    )
    expect(cancelBulkOperation).toHaveBeenCalledWith({
      organization: expect.any(Object),
      storeFqdn: 'shop.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/12345',
      remoteApp,
    })
  })

  test('passes full GID operation ID correctly', async () => {
    // When
    await BulkCancel.run(['--id', 'gid://shopify/BulkOperation/67890', '--store', 'shop'])

    // Then
    expect(cancelBulkOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'gid://shopify/BulkOperation/67890',
      }),
    )
  })
})

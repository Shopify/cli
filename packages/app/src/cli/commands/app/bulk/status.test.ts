import BulkStatus from './status.js'
import {getBulkOperationStatus, listBulkOperations} from '../../../services/bulk-operations/bulk-operation-status.js'
import {prepareAppStoreContext} from '../../../utilities/execute-command-helpers.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../../services/bulk-operations/bulk-operation-status.js')
vi.mock('../../../utilities/execute-command-helpers.js')
vi.mock('../../../services/bulk-operations/status-result.js')
vi.mock('../../../services/bulk-operations/progress.js')

describe('app bulk status command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const organization = testOrganization()
  const store = testOrganizationStore({shopDomain: 'shop.myshopify.com'})

  beforeEach(() => {
    vi.mocked(prepareAppStoreContext).mockResolvedValue({
      appContextResult: {
        app,
        remoteApp,
        developerPlatformClient: remoteApp.developerPlatformClient,
        organization,
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      },
      store,
    })
    vi.mocked(getBulkOperationStatus).mockResolvedValue({
      operationId: 'gid://shopify/BulkOperation/123',
      operation: null,
    })
    vi.mocked(listBulkOperations).mockResolvedValue({operations: []})
  })

  test('calls getBulkOperationStatus when id is provided', async () => {
    // When
    await BulkStatus.run(['--id', '123', '--store', 'shop.myshopify.com'])

    // Then
    expect(prepareAppStoreContext).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        store: 'shop.myshopify.com',
      }),
    )
    expect(getBulkOperationStatus).toHaveBeenCalledWith({
      storeFqdn: 'shop.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
      remoteApp,
    })
    expect(listBulkOperations).not.toHaveBeenCalled()
  })

  test('calls listBulkOperations when id is not provided', async () => {
    // When
    await BulkStatus.run(['--store', 'shop.myshopify.com'])

    // Then
    expect(prepareAppStoreContext).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'shop.myshopify.com',
      }),
    )
    expect(listBulkOperations).toHaveBeenCalledWith({
      storeFqdn: 'shop.myshopify.com',
      remoteApp,
    })
    expect(getBulkOperationStatus).not.toHaveBeenCalled()
  })
})

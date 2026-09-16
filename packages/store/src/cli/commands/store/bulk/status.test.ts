import StoreBulkStatus from './status.js'
import {prepareBulkAdminContext} from '../../../services/store/bulk/bulk-admin-context.js'
import {renderBulkOperationStatusResult} from '../../../services/store/bulk/status-result.js'
import {renderBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {getBulkOperationStatus, listBulkOperations} from '../../../services/store/bulk/bulk-operation-status.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/bulk-operation-status.js', async () => {
  const actual = await vi.importActual('../../../services/store/bulk/bulk-operation-status.js')
  return {
    ...actual,
    getBulkOperationStatus: vi.fn(),
    listBulkOperations: vi.fn(),
  }
})

vi.mock('../../../services/store/bulk/bulk-admin-context.js')
vi.mock('../../../services/store/bulk/status-result.js')
vi.mock('../../../services/store/bulk/progress.js')

describe('store bulk status command', () => {
  beforeEach(() => {
    vi.mocked(prepareBulkAdminContext).mockResolvedValue({token: 'token', storeFqdn: 'shop.myshopify.com'})
    vi.mocked(getBulkOperationStatus).mockResolvedValue({
      operationId: 'gid://shopify/BulkOperation/123',
      operation: null,
    })
    vi.mocked(listBulkOperations).mockResolvedValue({operations: []})
  })

  test('selects JSON presentation', async () => {
    await StoreBulkStatus.run(['--store', 'shop.myshopify.com', '--json'])
    expect(renderBulkOperationStatusResult).toHaveBeenCalledWith({operations: []}, 'json')
    expect(renderBulkOperationStart).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 'json')
    expect(StoreBulkStatus.jsonOutputSchema).toBeDefined()
    expect(StoreBulkStatus.flags.json).toBeDefined()
  })

  test('fetches a single operation when --id is provided, normalizing the ID', async () => {
    await StoreBulkStatus.run(['--store', 'shop.myshopify.com', '--id', '123'])

    expect(getBulkOperationStatus).toHaveBeenCalledWith({
      adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
      operationId: 'gid://shopify/BulkOperation/123',
    })
    expect(listBulkOperations).not.toHaveBeenCalled()
  })

  test('lists operations when --id is omitted', async () => {
    await StoreBulkStatus.run(['--store', 'shop.myshopify.com'])

    expect(listBulkOperations).toHaveBeenCalledWith({adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'}})
    expect(getBulkOperationStatus).not.toHaveBeenCalled()
  })
})

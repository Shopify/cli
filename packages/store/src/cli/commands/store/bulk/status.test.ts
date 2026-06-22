import StoreBulkStatus from './status.js'
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

describe('store bulk status command', () => {
  beforeEach(() => {
    vi.mocked(getBulkOperationStatus).mockResolvedValue()
    vi.mocked(listBulkOperations).mockResolvedValue()
  })

  test('fetches a single operation when --id is provided, normalizing the ID', async () => {
    await StoreBulkStatus.run(['--store', 'shop.myshopify.com', '--id', '123'])

    expect(getBulkOperationStatus).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
    })
    expect(listBulkOperations).not.toHaveBeenCalled()
  })

  test('lists operations when --id is omitted', async () => {
    await StoreBulkStatus.run(['--store', 'shop.myshopify.com'])

    expect(listBulkOperations).toHaveBeenCalledWith({store: 'shop.myshopify.com'})
    expect(getBulkOperationStatus).not.toHaveBeenCalled()
  })
})

import StoreBulkCancel from './cancel.js'
import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/cancel-bulk-operation.js')

describe('store bulk cancel command', () => {
  beforeEach(() => {
    vi.mocked(cancelBulkOperation).mockResolvedValue()
  })

  test('cancels the operation, normalizing the ID', async () => {
    await StoreBulkCancel.run(['--store', 'shop.myshopify.com', '--id', '123'])

    expect(cancelBulkOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
    })
  })
})

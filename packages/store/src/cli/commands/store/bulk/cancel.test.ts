import StoreBulkCancel from './cancel.js'
import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/cancel-bulk-operation.js')

describe('store bulk cancel command', () => {
  beforeEach(() => {
    vi.mocked(cancelBulkOperation).mockResolvedValue()
  })

  test('forwards the store and flag-normalized id to the service', async () => {
    await StoreBulkCancel.run(['--store', 'shop.myshopify.com', '--id', '123'])

    // The --id flag's parse normalizes '123' to a GID before the command forwards it.
    expect(cancelBulkOperation).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
    })
  })
})

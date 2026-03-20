import StoreBulkStatus from './status.js'
import {storeGetBulkOperationStatus, storeListBulkOperations} from '../../../services/store-bulk-operation-status.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store-bulk-operation-status.js')

describe('store bulk status command', () => {
  test('requires --store flag', async () => {
    await expect(StoreBulkStatus.run([], import.meta.url)).rejects.toThrow()

    expect(storeGetBulkOperationStatus).not.toHaveBeenCalled()
    expect(storeListBulkOperations).not.toHaveBeenCalled()
  })

  test('calls storeGetBulkOperationStatus when --id is provided', async () => {
    vi.mocked(storeGetBulkOperationStatus).mockResolvedValue()

    await StoreBulkStatus.run(
      ['--store', 'test-store.myshopify.com', '--id', '123'],
      import.meta.url,
    )

    expect(storeGetBulkOperationStatus).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
    })
  })

  test('calls storeListBulkOperations when --id is not provided', async () => {
    vi.mocked(storeListBulkOperations).mockResolvedValue()

    await StoreBulkStatus.run(
      ['--store', 'test-store.myshopify.com'],
      import.meta.url,
    )

    expect(storeListBulkOperations).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
    })
  })

  test('accepts full GID format for --id', async () => {
    vi.mocked(storeGetBulkOperationStatus).mockResolvedValue()

    await StoreBulkStatus.run(
      ['--store', 'test-store.myshopify.com', '--id', 'gid://shopify/BulkOperation/456'],
      import.meta.url,
    )

    expect(storeGetBulkOperationStatus).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/456',
    })
  })
})

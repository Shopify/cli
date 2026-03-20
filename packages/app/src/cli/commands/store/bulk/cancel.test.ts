import StoreBulkCancel from './cancel.js'
import {storeCancelBulkOperation} from '../../../services/store-bulk-cancel-operation.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store-bulk-cancel-operation.js')

describe('store bulk cancel command', () => {
  test('requires --store flag', async () => {
    await expect(
      StoreBulkCancel.run(['--id', '123'], import.meta.url),
    ).rejects.toThrow()

    expect(storeCancelBulkOperation).not.toHaveBeenCalled()
  })

  test('requires --id flag', async () => {
    await expect(
      StoreBulkCancel.run(['--store', 'test-store.myshopify.com'], import.meta.url),
    ).rejects.toThrow()

    expect(storeCancelBulkOperation).not.toHaveBeenCalled()
  })

  test('calls storeCancelBulkOperation with correct arguments', async () => {
    vi.mocked(storeCancelBulkOperation).mockResolvedValue()

    await StoreBulkCancel.run(
      ['--store', 'test-store.myshopify.com', '--id', '123'],
      import.meta.url,
    )

    expect(storeCancelBulkOperation).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/123',
    })
  })

  test('accepts full GID format for --id', async () => {
    vi.mocked(storeCancelBulkOperation).mockResolvedValue()

    await StoreBulkCancel.run(
      ['--store', 'test-store.myshopify.com', '--id', 'gid://shopify/BulkOperation/456'],
      import.meta.url,
    )

    expect(storeCancelBulkOperation).toHaveBeenCalledWith({
      storeFqdn: 'test-store.myshopify.com',
      operationId: 'gid://shopify/BulkOperation/456',
    })
  })
})

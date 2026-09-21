import StoreBulkCancel from './cancel.js'
import {prepareBulkAdminContext} from '../../../services/store/bulk/bulk-admin-context.js'
import {renderCancelBulkOperationResult} from '../../../services/store/bulk/cancel-result.js'
import {logBulkOperationStart} from '../../../services/store/bulk/progress.js'
import {cancelBulkOperation} from '../../../services/store/bulk/cancel-bulk-operation.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/bulk/cancel-bulk-operation.js')

vi.mock('../../../services/store/bulk/bulk-admin-context.js')
vi.mock('../../../services/store/bulk/cancel-result.js')
vi.mock('../../../services/store/bulk/progress.js')

describe('store bulk cancel command', () => {
  beforeEach(() => {
    vi.mocked(prepareBulkAdminContext).mockResolvedValue({token: 'token', storeFqdn: 'shop.myshopify.com'})
    vi.mocked(cancelBulkOperation).mockResolvedValue({operation: null, userErrors: []})
  })

  test('selects JSON presentation', async () => {
    await StoreBulkCancel.run(['--store', 'shop.myshopify.com', '--id', '123', '--json'])
    expect(renderCancelBulkOperationResult).toHaveBeenCalledWith(
      expect.anything(),
      'gid://shopify/BulkOperation/123',
      'json',
    )
    expect(logBulkOperationStart).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 'json')
    expect(StoreBulkCancel.jsonOutputSchema).toBeDefined()
    expect(StoreBulkCancel.flags.json).toBeDefined()
  })

  test('forwards the store and flag-normalized id to the service', async () => {
    await StoreBulkCancel.run(['--store', 'shop.myshopify.com', '--id', '123'])

    // The --id flag's parse normalizes '123' to a GID before the command forwards it.
    expect(cancelBulkOperation).toHaveBeenCalledWith({
      adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
      operationId: 'gid://shopify/BulkOperation/123',
    })
  })
})

import {cancelBulkOperationRequest} from './cancel.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {adminRequestDoc} from '../admin.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../admin.js')

const adminSession = {token: 'token', storeFqdn: 'shop.myshopify.com'}

describe('cancelBulkOperationRequest', () => {
  test('returns the bulkOperationCancel payload', async () => {
    const payload = {bulkOperation: {id: 'gid://shopify/BulkOperation/1', status: 'CANCELING'}, userErrors: []}
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperationCancel: payload})

    const result = await cancelBulkOperationRequest({adminSession, operationId: 'gid://shopify/BulkOperation/1'})

    expect(result).toEqual(payload)
    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        session: adminSession,
        variables: {id: 'gid://shopify/BulkOperation/1'},
        version: BULK_OPERATIONS_MIN_API_VERSION,
      }),
    )
  })

  test('uses the provided version when given', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperationCancel: null})

    await cancelBulkOperationRequest({adminSession, operationId: 'gid://shopify/BulkOperation/1', version: '2025-10'})

    expect(adminRequestDoc).toHaveBeenCalledWith(expect.objectContaining({version: '2025-10'}))
  })
})

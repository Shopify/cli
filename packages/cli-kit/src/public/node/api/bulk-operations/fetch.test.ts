import {fetchBulkOperationById, fetchRecentBulkOperations} from './fetch.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {adminRequestDoc} from '../admin.js'
import {describe, test, expect, vi} from 'vitest'

vi.mock('../admin.js')

const adminSession = {token: 'token', storeFqdn: 'shop.myshopify.com'}

describe('fetchBulkOperationById', () => {
  test('returns the operation from the response', async () => {
    const operation = {id: 'gid://shopify/BulkOperation/1', status: 'RUNNING'}
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: operation})

    const result = await fetchBulkOperationById({adminSession, operationId: 'gid://shopify/BulkOperation/1'})

    expect(result).toEqual(operation)
    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        session: adminSession,
        variables: {id: 'gid://shopify/BulkOperation/1'},
        version: BULK_OPERATIONS_MIN_API_VERSION,
      }),
    )
  })

  test('uses the provided version when given', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperation: null})

    await fetchBulkOperationById({adminSession, operationId: 'gid://shopify/BulkOperation/1', version: '2025-10'})

    expect(adminRequestDoc).toHaveBeenCalledWith(expect.objectContaining({version: '2025-10'}))
  })
})

describe('fetchRecentBulkOperations', () => {
  test('returns the list of nodes', async () => {
    const nodes = [{id: 'gid://shopify/BulkOperation/1'}, {id: 'gid://shopify/BulkOperation/2'}]
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperations: {nodes}})

    const result = await fetchRecentBulkOperations({adminSession})

    expect(result).toEqual(nodes)
    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        session: adminSession,
        variables: expect.objectContaining({first: 100, sortKey: 'CREATED_AT'}),
      }),
    )
  })

  test('builds a created_at filter from sinceDays', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({bulkOperations: {nodes: []}})

    await fetchRecentBulkOperations({adminSession, sinceDays: 1, first: 5})

    const call = vi.mocked(adminRequestDoc).mock.calls[0]![0] as unknown as {
      variables: {query: string; first: number}
    }
    expect(call.variables.query).toMatch(/^created_at:>=\d{4}-\d{2}-\d{2}$/)
    expect(call.variables.first).toBe(5)
  })
})

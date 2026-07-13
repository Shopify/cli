import {runBulkOperationMutations} from './run-mutations.js'
import {stageFile} from './stage-file.js'
import {adminRequestDoc} from '../admin.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../admin.js')
vi.mock('./stage-file.js')

describe('runBulkOperationMutations', () => {
  const mockSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
  const parentBulkOperation = {
    id: 'gid://shopify/BulkOperation/789',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    objectCount: '0',
    url: null,
  }
  const mockSuccessResponse = {
    bulkOperationRunMutations: {
      bulkOperation: parentBulkOperation,
      userErrors: [],
    },
  }

  const operations = [
    {
      mutation: 'mutation SetProducts($input: ProductSetInput!) { productSet(input: $input) { product { id } } }',
      variablesJsonl: '{"$key":"a","input":{}}',
    },
    {
      mutation:
        'mutation Publish($id: ID!) { publishablePublish(id: $id, input: []) { publishable { publishedOnCurrentPublication } } }',
      variablesJsonl: '{"id":"$ref:SetProducts[a].product.id"}',
    },
  ]

  beforeEach(() => {
    // Give each staged upload a path derived from its variables so we can assert the mapping.
    vi.mocked(stageFile).mockImplementation(async ({variablesJsonl}) => `staged/${variablesJsonl}`)
  })

  test('returns the plan parent bulk operation when the request succeeds', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    const result = await runBulkOperationMutations({adminSession: mockSession, operations})

    expect(result?.bulkOperation).toEqual(parentBulkOperation)
    expect(result?.userErrors).toEqual([])
  })

  test('stages every operation and builds an ordered operations argument pairing each mutation with its staged path', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    await runBulkOperationMutations({adminSession: mockSession, operations})

    expect(stageFile).toHaveBeenCalledTimes(2)
    expect(adminRequestDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          operations: [
            {mutation: operations[0]!.mutation, stagedUploadPath: `staged/${operations[0]!.variablesJsonl}`},
            {mutation: operations[1]!.mutation, stagedUploadPath: `staged/${operations[1]!.variablesJsonl}`},
          ],
        },
      }),
    )
  })

  test('forwards a specific API version when provided', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue(mockSuccessResponse)

    await runBulkOperationMutations({adminSession: mockSession, operations, version: '2025-01'})

    expect(adminRequestDoc).toHaveBeenCalledWith(expect.objectContaining({version: '2025-01'}))
  })

  test('returns user errors when the plan is rejected', async () => {
    vi.mocked(adminRequestDoc).mockResolvedValue({
      bulkOperationRunMutations: {
        bulkOperation: null,
        userErrors: [{code: 'ANONYMOUS_OPERATION', field: ['operations', '0'], message: 'must be named'}],
      },
    })

    const result = await runBulkOperationMutations({adminSession: mockSession, operations})

    expect(result?.bulkOperation).toBeNull()
    expect(result?.userErrors).toEqual([
      {code: 'ANONYMOUS_OPERATION', field: ['operations', '0'], message: 'must be named'},
    ])
  })
})

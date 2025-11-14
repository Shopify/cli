import {executeBulkOperation} from './execute-bulk-operation.js'
import {runBulkOperationQuery} from './run-query.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {describe, test, expect, vi} from 'vitest'

vi.mock('./run-query.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('executeBulkOperation', () => {
  const mockApp = {
    name: 'Test App',
  } as AppLinkedInterface

  const storeFqdn = 'test-store.myshopify.com'
  const query = 'query { products { edges { node { id } } } }'

  const successfulBulkOperation = {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    objectCount: '0',
    fileSize: '0',
    url: null,
  }

  test('executeBulkOperation successfully runs', async () => {
    const mockResponse = {
      bulkOperation: successfulBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse as any)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
    })

    expect(runBulkOperationQuery).toHaveBeenCalledWith({
      storeFqdn,
      query,
    })

    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Starting bulk operation.',
      body: `App: ${mockApp.name}\nStore: ${storeFqdn}`,
    })

    expect(renderInfo).toHaveBeenCalledWith({
      customSections: expect.arrayContaining([
        expect.objectContaining({
          title: 'Bulk Operation Created',
        }),
      ]),
    })

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Bulk operation started successfully!',
      body: 'Congrats!',
    })
  })

  test('executeBulkOperation renders warning when user errors are present', async () => {
    const mockResponse = {
      bulkOperation: null,
      userErrors: [
        {field: ['query'], message: 'Invalid query syntax'},
        {field: null, message: 'Another error'},
      ],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse as any)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
    })

    expect(renderWarning).toHaveBeenCalledWith({
      headline: 'Bulk operation errors.',
      body: 'query: Invalid query syntax\nunknown: Another error',
    })

    expect(renderSuccess).not.toHaveBeenCalled()
  })
})

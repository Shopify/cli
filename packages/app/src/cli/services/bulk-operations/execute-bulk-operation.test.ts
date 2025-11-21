import {executeBulkOperation} from './execute-bulk-operation.js'
import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('./run-query.js')
vi.mock('./run-mutation.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')

describe('executeBulkOperation', () => {
  const mockApp = {
    name: 'Test App',
  } as AppLinkedInterface

  const storeFqdn = 'test-store.myshopify.com'
  const mockAdminSession = {token: 'test-token', storeFqdn}

  const successfulBulkOperation = {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    objectCount: '0',
    fileSize: '0',
    url: null,
  }

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
  })

  test('runs query operation when GraphQL document starts with query', async () => {
    const query = 'query { products { edges { node { id } } } }'
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
      adminSession: mockAdminSession,
      query,
      variables: undefined,
    })
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('runs query operation when GraphQL document starts with curly brace', async () => {
    const query = '{ products { edges { node { id } } } }'
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
      adminSession: mockAdminSession,
      query,
      variables: undefined,
    })
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('runs mutation operation when GraphQL document starts with mutation', async () => {
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
    const mockResponse = {
      bulkOperation: successfulBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse as any)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query: mutation,
    })

    expect(runBulkOperationMutation).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: mutation,
      variables: undefined,
    })
    expect(runBulkOperationQuery).not.toHaveBeenCalled()
  })

  test('passes variables parameter to runBulkOperationMutation when variables are provided', async () => {
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
    const variables = ['{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}']
    const mockResponse = {
      bulkOperation: successfulBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse as any)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query: mutation,
      variables,
    })

    expect(runBulkOperationMutation).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: mutation,
      variables,
    })
  })

  test('renders success message when bulk operation returns without user errors', async () => {
    const query = '{ products { edges { node { id } } } }'
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

    expect(renderSuccess).toHaveBeenCalledWith({
      headline: 'Bulk operation started successfully!',
      body: 'Congrats!',
    })
  })

  test('renders warning with formatted field errors when bulk operation returns user errors', async () => {
    const query = '{ products { edges { node { id } } } }'
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

  test('throws GraphQL syntax error when given malformed GraphQL document', async () => {
    const malformedQuery = '{ products { edges { node { id } }'

    await expect(
      executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query: malformedQuery,
      }),
    ).rejects.toThrow('Syntax Error')

    expect(runBulkOperationQuery).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('throws error when GraphQL document contains multiple operation definitions', async () => {
    const multipleOperations =
      'mutation { productUpdate(input: {}) { product { id } } } mutation { productDelete(input: {}) { deletedProductId } }'

    await expect(
      executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query: multipleOperations,
      }),
    ).rejects.toThrow('Multiple operations are not supported')

    expect(runBulkOperationQuery).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('throws error when GraphQL document contains no operation definitions', async () => {
    const noOperations = `
      fragment ProductFields on Product {
        id
        title
      }
    `

    await expect(
      executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query: noOperations,
      }),
    ).rejects.toThrow('must contain exactly one operation definition')

    expect(runBulkOperationQuery).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })
})

import {executeBulkOperation} from './execute-bulk-operation.js'
import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation} from './watch-bulk-operation.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {BulkOperationRunQueryMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {BulkOperationRunMutationMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-mutation.js'
import {renderSuccess, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('./run-query.js')
vi.mock('./run-mutation.js')
vi.mock('./watch-bulk-operation.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')

describe('executeBulkOperation', () => {
  const mockApp = {
    name: 'Test App',
  } as AppLinkedInterface

  const storeFqdn = 'test-store.myshopify.com'
  const mockAdminSession = {token: 'test-token', storeFqdn}

  const createdBulkOperation: NonNullable<
    NonNullable<BulkOperationRunQueryMutation['bulkOperationRunQuery']>['bulkOperation']
  > = {
    id: 'gid://shopify/BulkOperation/123',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    objectCount: '0',
    url: null,
    partialDataUrl: null,
  }

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
  })

  test('runs query operation when GraphQL document starts with query', async () => {
    const query = 'query { products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

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
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

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
    const mockResponse: BulkOperationRunMutationMutation['bulkOperationRunMutation'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse)

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

  test('passes variables to mutation when provided with `--variables` flag', async () => {
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
    const variables = ['{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}']
    const mockResponse: BulkOperationRunMutationMutation['bulkOperationRunMutation'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse)

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

  test('renders success message when bulk operation is created', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation started.',
      }),
    )
  })

  test('renders warning when user errors are present', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: null,
      userErrors: [
        {field: ['query'], message: 'Invalid query syntax', code: null},
        {field: null, message: 'Another error', code: null},
      ],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

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

  test('waits for operation to finish and renders success when watch is provided and operation finishes with COMPLETED status', async () => {
    const query = '{ products { edges { node { id } } } }'
    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '650',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
      watch: true,
    })

    expect(watchBulkOperation).toHaveBeenCalledWith(mockAdminSession, createdBulkOperation.id)
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('Bulk operation succeeded.'),
        body: expect.arrayContaining([expect.stringContaining('https://example.com/download')]),
      }),
    )
  })

  test.each(['FAILED', 'CANCELED', 'EXPIRED'] as const)(
    'waits for operation to finish and renders error when watch is provided and operation finishes with %s status',
    async (status) => {
      const query = '{ products { edges { node { id } } } }'
      const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
        bulkOperation: createdBulkOperation,
        userErrors: [],
      }
      const finishedOperation = {
        ...createdBulkOperation,
        status,
        objectCount: '100',
      }

      vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
      vi.mocked(watchBulkOperation).mockResolvedValue(finishedOperation)

      await executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query,
        watch: true,
      })

      expect(watchBulkOperation).toHaveBeenCalledWith(mockAdminSession, createdBulkOperation.id)
      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: expect.any(String),
          customSections: expect.any(Array),
        }),
      )
    },
  )
})

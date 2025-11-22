import {executeBulkOperation} from './execute-bulk-operation.js'
import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation} from './watch-bulk-operation.js'
import {downloadBulkOperationResults} from './download-bulk-operation-results.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {BulkOperationRunQueryMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {BulkOperationRunMutationMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-mutation.js'
import {renderSuccess, renderWarning, renderError} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('./run-query.js')
vi.mock('./run-mutation.js')
vi.mock('./watch-bulk-operation.js')
vi.mock('./download-bulk-operation-results.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/fs')

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
    objectCount: '0',
    fileSize: '0',
    url: null,
    query: '{ products { edges { node { id } } } }',
    rootObjectCount: '0',
    type: 'QUERY',
    completedAt: null,
    partialDataUrl: null,
  }

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
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
      variablesJsonl: undefined,
    })
    expect(runBulkOperationQuery).not.toHaveBeenCalled()
  })

  test('passes variables parameter to runBulkOperationMutation when variables are provided', async () => {
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
      variablesJsonl: '{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}',
    })
  })

  test('renders success message when bulk operation returns without user errors', async () => {
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

  test('renders warning with formatted field errors when bulk operation returns user errors', async () => {
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

  test('reads variables from file when variableFile is provided', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const variableFilePath = joinPath(tmpDir, 'variables.jsonl')
      const variables = [
        '{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}',
        '{"input":{"id":"gid://shopify/Product/456","tags":["test2"]}}',
      ]
      await writeFile(variableFilePath, variables.join('\n'))

      const mutation =
        'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
      const mockResponse = {
        bulkOperation: createdBulkOperation,
        userErrors: [],
      }
      vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse as any)

      await executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query: mutation,
        variableFile: variableFilePath,
      })

      expect(runBulkOperationMutation).toHaveBeenCalledWith({
        adminSession: mockAdminSession,
        query: mutation,
        variablesJsonl: variables.join('\n'),
      })
    })
  })

  test('throws error when variableFile does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const nonExistentPath = joinPath(tmpDir, 'nonexistent.jsonl')
      const mutation =
        'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'

      await expect(
        executeBulkOperation({
          app: mockApp,
          storeFqdn,
          query: mutation,
          variableFile: nonExistentPath,
        }),
      ).rejects.toThrow('Variable file not found')

      expect(runBulkOperationQuery).not.toHaveBeenCalled()
      expect(runBulkOperationMutation).not.toHaveBeenCalled()
    })
  })

  test('throws error when variables are provided with a query (not mutation)', async () => {
    const query = 'query { products { edges { node { id } } } }'
    const variables = ['{"input":{"id":"gid://shopify/Product/123"}}']

    await expect(
      executeBulkOperation({
        app: mockApp,
        storeFqdn,
        query,
        variables,
      }),
    ).rejects.toThrow('can only be used with mutations, not queries')

    expect(runBulkOperationQuery).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('throws error when variableFile is provided with a query (not mutation)', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const variableFilePath = joinPath(tmpDir, 'variables.jsonl')
      await writeFile(variableFilePath, '{"input":{}}')

      const query = 'query { products { edges { node { id } } } }'

      await expect(
        executeBulkOperation({
          app: mockApp,
          storeFqdn,
          query,
          variableFile: variableFilePath,
        }),
      ).rejects.toThrow('can only be used with mutations, not queries')

      expect(runBulkOperationQuery).not.toHaveBeenCalled()
      expect(runBulkOperationMutation).not.toHaveBeenCalled()
    })
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
    vi.mocked(downloadBulkOperationResults).mockResolvedValue('{"id":"gid://shopify/Product/123"}')

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
      watch: true,
    })

    expect(watchBulkOperation).toHaveBeenCalledWith(mockAdminSession, createdBulkOperation.id)
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('Bulk operation succeeded:'),
      }),
    )
  })

  test('writes results to file when --output-file flag is provided', async () => {
    const query = '{ products { edges { node { id } } } }'
    const outputFile = '/tmp/results.jsonl'
    const resultsContent = '{"id":"gid://shopify/Product/123"}\n{"id":"gid://shopify/Product/456"}'

    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '2',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(resultsContent)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
      watch: true,
      outputFile,
    })

    expect(writeFile).toHaveBeenCalledWith(outputFile, resultsContent)
  })

  test('writes results to stdout when --output-file flag is not provided', async () => {
    const query = '{ products { edges { node { id } } } }'
    const resultsContent = '{"id":"gid://shopify/Product/123"}\n{"id":"gid://shopify/Product/456"}'

    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '2',
    }

    const mockOutput = mockAndCaptureOutput()

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(resultsContent)

    await executeBulkOperation({
      app: mockApp,
      storeFqdn,
      query,
      watch: true,
    })

    expect(mockOutput.info()).toContain(resultsContent)
    expect(writeFile).not.toHaveBeenCalled()
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

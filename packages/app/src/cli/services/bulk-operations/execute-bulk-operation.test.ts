import {executeBulkOperation} from './execute-bulk-operation.js'
import {runBulkOperationQuery} from './run-query.js'
import {runBulkOperationMutation} from './run-mutation.js'
import {watchBulkOperation, shortBulkOperationPoll} from './watch-bulk-operation.js'
import {downloadBulkOperationResults} from './download-bulk-operation-results.js'
import {BULK_OPERATIONS_MIN_API_VERSION} from './constants.js'
import {resolveApiVersion} from '../graphql/common.js'
import {BulkOperationRunQueryMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-query.js'
import {BulkOperationRunMutationMutation} from '../../api/graphql/bulk-operations/generated/bulk-operation-run-mutation.js'
import {OrganizationApp, OrganizationSource, OrganizationStore} from '../../models/organization.js'
import {renderSuccess, renderWarning, renderError, renderInfo} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdminAsApp} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('./run-query.js')
vi.mock('./run-mutation.js')
vi.mock('./watch-bulk-operation.js')
vi.mock('./download-bulk-operation-results.js')
vi.mock('../graphql/common.js', async () => {
  const actual = await vi.importActual('../graphql/common.js')
  return {
    ...actual,
    resolveApiVersion: vi.fn(),
    validateMutationStore: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/session', async () => {
  const actual = await vi.importActual('@shopify/cli-kit/node/session')
  return {
    ...actual,
    ensureAuthenticatedAdminAsApp: vi.fn(),
  }
})

describe('executeBulkOperation', () => {
  const mockOrganization = {
    id: 'test-org-id',
    businessName: 'Test Organization',
    source: OrganizationSource.BusinessPlatform,
  }

  const mockRemoteApp = {
    apiKey: 'test-app-client-id',
    apiSecretKeys: [{secret: 'test-api-secret'}],
    title: 'Test App',
  } as OrganizationApp

  const storeFqdn = 'test-store.myshopify.com'
  const mockStore: OrganizationStore = {
    shopId: '123',
    link: 'https://test-store.myshopify.com/admin',
    shopDomain: storeFqdn,
    shopName: 'Test Store',
    transferDisabled: false,
    convertableToPartnerTest: false,
    provisionable: true,
  }
  const mockAdminSession = {token: 'test-token', storeFqdn}

  const createdBulkOperation: NonNullable<
    NonNullable<BulkOperationRunQueryMutation['bulkOperationRunQuery']>['bulkOperation']
  > = {
    id: 'gid://shopify/BulkOperation/123',
    type: 'QUERY',
    status: 'CREATED',
    errorCode: null,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: null,
    objectCount: '0',
    url: null,
    partialDataUrl: null,
  }

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdminAsApp).mockResolvedValue(mockAdminSession)
    vi.mocked(shortBulkOperationPoll).mockResolvedValue(createdBulkOperation)
    vi.mocked(resolveApiVersion).mockResolvedValue(BULK_OPERATIONS_MIN_API_VERSION)
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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(runBulkOperationQuery).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query,
      version: BULK_OPERATIONS_MIN_API_VERSION,
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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(runBulkOperationQuery).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query,
      version: BULK_OPERATIONS_MIN_API_VERSION,
    })
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('runs mutation operation when GraphQL document starts with mutation', async () => {
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'
    const variables = ['{"input":{"id":"gid://shopify/Product/123"}}']
    const mockResponse: BulkOperationRunMutationMutation['bulkOperationRunMutation'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationMutation).mockResolvedValue(mockResponse)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query: mutation,
      variables,
    })

    expect(runBulkOperationMutation).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: mutation,
      variablesJsonl: '{"input":{"id":"gid://shopify/Product/123"}}',
      version: BULK_OPERATIONS_MIN_API_VERSION,
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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query: mutation,
      variables,
    })

    expect(runBulkOperationMutation).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: mutation,
      variablesJsonl: '{"input":{"id":"gid://shopify/Product/123","tags":["test"]}}',
      version: BULK_OPERATIONS_MIN_API_VERSION,
    })
  })

  test('renders running message when bulk operation returns without user errors', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation is running.',
        body: ['Monitor its progress with:\n', {command: expect.stringContaining('shopify app bulk status')}],
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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(renderError).toHaveBeenCalledWith({
      headline: 'Error creating bulk operation.',
      body: {
        list: {
          items: ['query: Invalid query syntax', 'Another error'],
        },
      },
    })

    expect(renderSuccess).not.toHaveBeenCalled()
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
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
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
          organization: mockOrganization,
          remoteApp: mockRemoteApp,
          store: mockStore,
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
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
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
          organization: mockOrganization,
          remoteApp: mockRemoteApp,
          store: mockStore,
          query,
          variableFile: variableFilePath,
        }),
      ).rejects.toThrow('can only be used with mutations, not queries')

      expect(runBulkOperationQuery).not.toHaveBeenCalled()
      expect(runBulkOperationMutation).not.toHaveBeenCalled()
    })
  })

  test('throws error when mutation is provided without variables', async () => {
    const mutation = 'mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id } } }'

    await expect(
      executeBulkOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
        query: mutation,
      }),
    ).rejects.toThrow('Bulk mutations require variables')

    expect(runBulkOperationQuery).not.toHaveBeenCalled()
    expect(runBulkOperationMutation).not.toHaveBeenCalled()
  })

  test('uses watchBulkOperation (not quickWatchBulkOperation) when watch flag is true', async () => {
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
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(
      '{"data":{"products":{"edges":[{"node":{"id":"gid://shopify/Product/123"}}],"userErrors":[]}},"__lineNumber":0}',
    )

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
    })

    expect(watchBulkOperation).toHaveBeenCalledWith(
      mockAdminSession,
      createdBulkOperation.id,
      expect.any(Object),
      expect.any(Function),
    )
    expect(shortBulkOperationPoll).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('Bulk operation succeeded:'),
      }),
    )
  })

  test('renders help message in an info banner when watch is provided and user aborts', async () => {
    const query = '{ products { edges { node { id } } } }'
    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const runningOperation = {
      ...createdBulkOperation,
      status: 'RUNNING' as const,
      objectCount: '100',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockImplementation(async (_session, _id, signal, onAbort) => {
      onAbort()
      return runningOperation
    })

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
    })

    expect(renderInfo).toHaveBeenCalledWith({
      headline: `Bulk operation ${createdBulkOperation.id} is still running in the background.`,
      body: ['Monitor its progress with:\n', {command: expect.stringContaining('shopify app bulk status')}],
    })
    expect(downloadBulkOperationResults).not.toHaveBeenCalled()
  })

  test('uses quickWatchBulkOperation (not watchBulkOperation) when watch flag is false', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
    vi.mocked(shortBulkOperationPoll).mockResolvedValue(createdBulkOperation)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: false,
    })

    expect(shortBulkOperationPoll).toHaveBeenCalledWith(mockAdminSession, createdBulkOperation.id)
    expect(watchBulkOperation).not.toHaveBeenCalled()
  })

  test('renders info message when quickWatchBulkOperation returns RUNNING status', async () => {
    const query = '{ products { edges { node { id } } } }'
    const runningOperation = {
      ...createdBulkOperation,
      status: 'RUNNING' as const,
      objectCount: '50',
    }
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
    vi.mocked(shortBulkOperationPoll).mockResolvedValue(runningOperation)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: false,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation is running.',
        body: ['Monitor its progress with:\n', {command: expect.stringContaining('shopify app bulk status')}],
      }),
    )
  })

  test('renders running message when quickWatchBulkOperation returns COMPLETED status (does not download results)', async () => {
    const query = '{ products { edges { node { id } } } }'
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '100',
    }
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
    vi.mocked(shortBulkOperationPoll).mockResolvedValue(completedOperation)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: false,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation is running.',
        body: ['Monitor its progress with:\n', {command: expect.stringContaining('shopify app bulk status')}],
      }),
    )
    expect(downloadBulkOperationResults).not.toHaveBeenCalled()
  })

  test.each(['FAILED', 'CANCELED', 'EXPIRED'] as const)(
    'renders error when quickWatchBulkOperation returns %s status',
    async (status) => {
      const query = '{ products { edges { node { id } } } }'
      const errorOperation = {
        ...createdBulkOperation,
        status,
        objectCount: '0',
      }
      const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
        bulkOperation: createdBulkOperation,
        userErrors: [],
      }

      vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)
      vi.mocked(shortBulkOperationPoll).mockResolvedValue(errorOperation)

      await executeBulkOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
        query,
        watch: false,
      })

      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: expect.any(String),
          customSections: expect.any(Array),
        }),
      )
    },
  )

  test('writes results to file when --output-file flag is provided', async () => {
    const query = '{ products { edges { node { id } } } }'
    const outputFile = '/tmp/results.jsonl'
    const resultsContent =
      '{"data":{"productCreate":{"product":{"id":"gid://shopify/Product/123"},"userErrors":[]}},"__lineNumber":0}\n{"data":{"productCreate":{"product":{"id":"gid://shopify/Product/456"},"userErrors":[]}},"__lineNumber":1}'

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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
      outputFile,
    })

    expect(writeFile).toHaveBeenCalledWith(outputFile, resultsContent)
  })

  test('writes results to stdout when --output-file flag is not provided', async () => {
    const query = '{ products { edges { node { id } } } }'
    const resultsContent =
      '{"data":{"productCreate":{"product":{"id":"gid://shopify/Product/123"},"userErrors":[]}},"__lineNumber":0}\n{"data":{"productCreate":{"product":{"id":"gid://shopify/Product/456"},"userErrors":[]}},"__lineNumber":1}'

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
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
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
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
        query,
        watch: true,
      })

      expect(renderError).toHaveBeenCalledWith(
        expect.objectContaining({
          headline: expect.any(String),
          customSections: expect.any(Array),
        }),
      )
    },
  )
  test('throws BugError and renders warning when bulk operation response returns null with no errors', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse = {
      bulkOperation: null,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

    await expect(
      executeBulkOperation({
        organization: mockOrganization,
        remoteApp: mockRemoteApp,
        store: mockStore,
        query,
      }),
    ).rejects.toThrow('Bulk operation response returned null with no error message.')

    expect(renderWarning).toHaveBeenCalledWith({
      headline: 'Bulk operation not created successfully.',
      body: 'This is an unexpected error. Please try again later.',
    })

    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders warning when completed operation results contain userErrors', async () => {
    const query = '{ products { edges { node { id } } } }'
    const resultsWithErrors = '{"data":{"productUpdate":{"userErrors":[{"message":"invalid input"}]}},"__lineNumber":0}'

    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '1',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(resultsWithErrors)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
    })

    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation completed with errors.',
        body: 'Check results for error details.',
      }),
    )
    expect(renderSuccess).not.toHaveBeenCalled()
  })

  test('renders success when completed operation results have no userErrors', async () => {
    const query = '{ products { edges { node { id } } } }'
    const resultsWithoutErrors = '{"data":{"productUpdate":{"product":{"id":"123"},"userErrors":[]}},"__lineNumber":0}'

    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '1',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(resultsWithoutErrors)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
    })

    expect(renderSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('Bulk operation succeeded'),
      }),
    )
    expect(renderWarning).not.toHaveBeenCalled()
  })

  test('renders warning when results written to file contain userErrors', async () => {
    const query = '{ products { edges { node { id } } } }'
    const outputFile = '/tmp/results.jsonl'
    const resultsWithErrors = '{"data":{"productUpdate":{"userErrors":[{"message":"invalid input"}]}},"__lineNumber":0}'

    const initialResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    const completedOperation = {
      ...createdBulkOperation,
      status: 'COMPLETED' as const,
      url: 'https://example.com/download',
      objectCount: '1',
    }

    vi.mocked(runBulkOperationQuery).mockResolvedValue(initialResponse)
    vi.mocked(watchBulkOperation).mockResolvedValue(completedOperation)
    vi.mocked(downloadBulkOperationResults).mockResolvedValue(resultsWithErrors)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
      watch: true,
      outputFile,
    })

    expect(writeFile).toHaveBeenCalledWith(outputFile, resultsWithErrors)
    expect(renderWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: 'Bulk operation completed with errors.',
        body: `Results written to ${outputFile}. Check file for error details.`,
      }),
    )
  })

  test('calls resolveApiVersion with minimum API version constant', async () => {
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(resolveApiVersion).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      userSpecifiedVersion: undefined,
      minimumDefaultVersion: BULK_OPERATIONS_MIN_API_VERSION,
    })
  })

  test('uses resolved API version when running bulk operation', async () => {
    vi.mocked(resolveApiVersion).mockResolvedValue('test-api-version')
    const query = '{ products { edges { node { id } } } }'
    const mockResponse: BulkOperationRunQueryMutation['bulkOperationRunQuery'] = {
      bulkOperation: createdBulkOperation,
      userErrors: [],
    }
    vi.mocked(runBulkOperationQuery).mockResolvedValue(mockResponse)

    await executeBulkOperation({
      organization: mockOrganization,
      remoteApp: mockRemoteApp,
      store: mockStore,
      query,
    })

    expect(runBulkOperationQuery).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query,
      version: 'test-api-version',
    })
  })
})

import BulkExecute from './execute.js'
import {renderExecuteBulkOperationResult} from '../../../services/bulk-operations/execute-result.js'
import {executeBulkOperation, prepareBulkOperation} from '../../../services/bulk-operations/execute-bulk-operation.js'
import {prepareExecuteContext} from '../../../utilities/execute-command-helpers.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('../../../services/bulk-operations/execute-bulk-operation.js')
vi.mock('../../../utilities/execute-command-helpers.js')
vi.mock('../../../services/bulk-operations/execute-result.js')
vi.mock('../../../services/bulk-operations/progress.js')

describe('app bulk execute command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const organization = testOrganization()
  const store = testOrganizationStore({shopDomain: 'shop.myshopify.com'})

  beforeEach(() => {
    vi.mocked(prepareExecuteContext).mockResolvedValue({
      appContextResult: {
        app,
        remoteApp,
        developerPlatformClient: remoteApp.developerPlatformClient,
        organization,
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      },
      store,
      query: 'query { shop { name } }',
    })
    vi.mocked(prepareBulkOperation).mockResolvedValue({
      adminSession: {storeFqdn: store.shopDomain, token: 'token'},
      version: '2026-01',
      query: 'query { shop { name } }',
      variablesJsonl: undefined,
      watch: false,
    })
    vi.mocked(executeBulkOperation).mockResolvedValue({operation: null, userErrors: [], watchAborted: false})
  })

  test('prepares execution context and calls executeBulkOperation', async () => {
    // When
    await BulkExecute.run(['--query', 'query { shop { name } }', '--store', 'shop.myshopify.com'])

    // Then
    expect(executeBulkOperation).toHaveBeenCalledWith(await vi.mocked(prepareBulkOperation).mock.results[0]!.value)
    expect(prepareExecuteContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query { shop { name } }',
        store: 'shop.myshopify.com',
      }),
    )
    expect(prepareBulkOperation).toHaveBeenCalledWith({
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: undefined,
      watch: false,
    })
  })

  test('passes input variables to preparation and output files to presentation', async () => {
    // When
    await BulkExecute.run([
      '--query',
      'query { shop { name } }',
      '--store',
      'shop.myshopify.com',
      '--variables',
      '{"key": "value"}',
      '--watch',
      '--output-file',
      'output.json',
    ])

    // Then
    expect(renderExecuteBulkOperationResult).toHaveBeenCalledWith(
      {operation: null, userErrors: [], watchAborted: false},
      {format: 'text', watch: true, outputFile: 'output.json'},
    )
    expect(prepareBulkOperation).toHaveBeenCalledWith({
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: ['{"key": "value"}'],
      variableFile: undefined,
      watch: true,
    })
  })

  test('calls executeBulkOperation with variable-file flag', async () => {
    // When
    await BulkExecute.run([
      '--query-file',
      'query.graphql',
      '--store',
      'shop.myshopify.com',
      '--variable-file',
      'variables.jsonl',
    ])

    // Then
    expect(prepareBulkOperation).toHaveBeenCalledWith({
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: expect.stringContaining('variables.jsonl'),
      watch: false,
    })
  })
})

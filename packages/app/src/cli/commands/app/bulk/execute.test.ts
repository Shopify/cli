import BulkExecute from './execute.js'
import {executeBulkOperation} from '../../../services/bulk-operations/execute-bulk-operation.js'
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
    vi.mocked(executeBulkOperation).mockResolvedValue()
  })

  test('prepares execution context and calls executeBulkOperation', async () => {
    // When
    await BulkExecute.run(['--query', 'query { shop { name } }', '--store', 'shop.myshopify.com'])

    // Then
    expect(prepareExecuteContext).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'query { shop { name } }',
        store: 'shop.myshopify.com',
      }),
    )
    expect(executeBulkOperation).toHaveBeenCalledWith({
      organization,
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: undefined,
      watch: false,
      outputFile: undefined,
    })
  })

  test('calls executeBulkOperation with variables flag', async () => {
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
    expect(executeBulkOperation).toHaveBeenCalledWith({
      organization,
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: ['{"key": "value"}'],
      variableFile: undefined,
      watch: true,
      outputFile: 'output.json',
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
    expect(executeBulkOperation).toHaveBeenCalledWith({
      organization,
      remoteApp,
      store,
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: expect.stringContaining('variables.jsonl'),
      watch: false,
      outputFile: undefined,
    })
  })
})

import {storeExecuteOperation} from './store-execute-operation.js'
import {resolveApiVersion} from './graphql/common.js'
import {runGraphQLExecution} from './execute-operation.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {ensureAuthenticatedAdmin} from '@shopify/cli-kit/node/session'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('./graphql/common.js')
vi.mock('./execute-operation.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/session')

describe('storeExecuteOperation', () => {
  const storeFqdn = 'test-store.myshopify.com'
  const mockAdminSession = {token: 'user-token', storeFqdn}

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedAdmin).mockResolvedValue(mockAdminSession)
    vi.mocked(resolveApiVersion).mockResolvedValue('2024-07')
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      return task(() => {})
    })
    vi.mocked(runGraphQLExecution).mockResolvedValue(undefined)
  })

  test('authenticates as user via ensureAuthenticatedAdmin', async () => {
    await storeExecuteOperation({
      storeFqdn,
      query: 'query { shop { name } }',
    })

    expect(ensureAuthenticatedAdmin).toHaveBeenCalledWith(storeFqdn)
  })

  test('resolves API version', async () => {
    await storeExecuteOperation({
      storeFqdn,
      query: 'query { shop { name } }',
    })

    expect(resolveApiVersion).toHaveBeenCalledWith({adminSession: mockAdminSession})
  })

  test('passes user-specified version to resolveApiVersion', async () => {
    await storeExecuteOperation({
      storeFqdn,
      query: 'query { shop { name } }',
      version: '2024-01',
    })

    expect(resolveApiVersion).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      userSpecifiedVersion: '2024-01',
    })
  })

  test('delegates to runGraphQLExecution with correct args', async () => {
    await storeExecuteOperation({
      storeFqdn,
      query: 'query { shop { name } }',
      variables: '{"key":"value"}',
      variableFile: '/path/to/vars.json',
      outputFile: '/path/to/output.json',
    })

    expect(runGraphQLExecution).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: 'query { shop { name } }',
      variables: '{"key":"value"}',
      variableFile: '/path/to/vars.json',
      outputFile: '/path/to/output.json',
      version: '2024-07',
    })
  })

  test('passes undefined optional fields when not provided', async () => {
    await storeExecuteOperation({
      storeFqdn,
      query: 'query { shop { name } }',
    })

    expect(runGraphQLExecution).toHaveBeenCalledWith({
      adminSession: mockAdminSession,
      query: 'query { shop { name } }',
      variables: undefined,
      variableFile: undefined,
      outputFile: undefined,
      version: '2024-07',
    })
  })
})

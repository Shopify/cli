import {executeStoreOperation} from './index.js'
import {prepareStoreExecuteRequest, type PreparedStoreExecuteRequest} from './request.js'
import {getStoreGraphQLTarget} from './targets.js'
import {recordStoreFqdnMetadata} from '../attribution.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {parse, type OperationDefinitionNode} from 'graphql'
import type {AdminStoreGraphQLContext} from './admin-context.js'

vi.mock('./request.js')
vi.mock('./targets.js')
vi.mock('../attribution.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('executeStoreOperation', () => {
  const request: PreparedStoreExecuteRequest = {
    query: 'query { shop { name } }',
    parsedOperation: {operationDefinition: parse('query { shop { name } }').definitions[0] as OperationDefinitionNode},
    parsedVariables: {id: 'gid://shopify/Shop/1'},
    requestedVersion: '2025-10',
  }
  const context: AdminStoreGraphQLContext = {
    adminSession: {token: 'token', storeFqdn: 'shop.myshopify.com'},
    version: '2025-10',
    session: {
      store: 'shop.myshopify.com',
      clientId: 'client-id',
      userId: 'user-id',
      accessToken: 'token',
      scopes: [],
      acquiredAt: '2026-06-15T00:00:00Z',
    },
  }
  const result = {data: {shop: {name: 'Test shop'}}}
  const target = {
    id: 'admin',
    prepareContext: vi.fn(),
    execute: vi.fn(),
  } satisfies ReturnType<typeof getStoreGraphQLTarget>

  beforeEach(() => {
    vi.mocked(prepareStoreExecuteRequest).mockResolvedValue(request)
    vi.mocked(getStoreGraphQLTarget).mockReturnValue(target)
    target.prepareContext.mockResolvedValue(context)
    target.execute.mockResolvedValue(result)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  afterEach(() => {
    mockAndCaptureOutput().clear()
  })

  test('prepares the request, loads context, and returns the execution result', async () => {
    await expect(
      executeStoreOperation({
        store: 'shop.myshopify.com',
        query: 'query { shop { name } }',
        variables: '{"id":"gid://shopify/Shop/1"}',
        version: '2025-10',
      }),
    ).resolves.toEqual(result)

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('shop.myshopify.com', false)
    expect(getStoreGraphQLTarget).toHaveBeenCalledWith('admin')
    expect(prepareStoreExecuteRequest).toHaveBeenCalledWith({
      query: 'query { shop { name } }',
      queryFile: undefined,
      variables: '{"id":"gid://shopify/Shop/1"}',
      variableFile: undefined,
      version: '2025-10',
      allowMutations: undefined,
    })
    expect(target.prepareContext).toHaveBeenCalledWith({
      store: 'shop.myshopify.com',
      requestedVersion: '2025-10',
    })
    expect(target.execute).toHaveBeenCalledWith({context, request})
  })

  test('defaults to the admin target', async () => {
    await executeStoreOperation({
      store: 'shop.myshopify.com',
      query: 'query { shop { name } }',
    })

    expect(getStoreGraphQLTarget).toHaveBeenCalledWith('admin')
  })

  test('records the requested store before request validation fails', async () => {
    vi.mocked(prepareStoreExecuteRequest).mockRejectedValue(new Error('Query should have a value'))

    await expect(
      executeStoreOperation({
        store: 'shop.myshopify.com',
      }),
    ).rejects.toThrow('Query should have a value')

    expect(recordStoreFqdnMetadata).toHaveBeenCalledWith('shop.myshopify.com', false)
    expect(target.prepareContext).not.toHaveBeenCalled()
    expect(target.execute).not.toHaveBeenCalled()
  })
})
